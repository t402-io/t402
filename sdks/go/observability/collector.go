package observability

import (
	"math/big"
	"sync"
	"time"
)

// DefaultBufferSize is the default ring buffer capacity.
const DefaultBufferSize = 1000

// Collector records payment events in a thread-safe ring buffer and computes aggregate metrics.
type Collector struct {
	mu       sync.RWMutex
	events   []PaymentEvent
	capacity int
	head     int // next write position
	count    int // total events stored (capped at capacity)
}

// NewCollector creates a Collector with the given ring buffer capacity.
// If capacity <= 0, DefaultBufferSize is used.
func NewCollector(capacity int) *Collector {
	if capacity <= 0 {
		capacity = DefaultBufferSize
	}
	return &Collector{
		events:   make([]PaymentEvent, capacity),
		capacity: capacity,
	}
}

// Record adds a payment event to the ring buffer.
// If the buffer is full the oldest event is overwritten.
func (c *Collector) Record(event PaymentEvent) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	c.mu.Lock()
	c.events[c.head] = event
	c.head = (c.head + 1) % c.capacity
	if c.count < c.capacity {
		c.count++
	}
	c.mu.Unlock()
}

// GetEvents returns events matching the filter. A zero-value filter matches everything.
func (c *Collector) GetEvents(filter EventFilter) []PaymentEvent {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var result []PaymentEvent
	for _, ev := range c.snapshot() {
		if filter.PaymentID != "" && ev.PaymentID != filter.PaymentID {
			continue
		}
		if filter.Type != "" && ev.Type != filter.Type {
			continue
		}
		if filter.Network != "" && ev.Network != filter.Network {
			continue
		}
		if !filter.Since.IsZero() && ev.Timestamp.Before(filter.Since) {
			continue
		}
		result = append(result, ev)
		if filter.Limit > 0 && len(result) >= filter.Limit {
			break
		}
	}
	return result
}

// GetMetrics computes aggregate metrics from all events in the buffer.
func (c *Collector) GetMetrics() PaymentMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()

	m := PaymentMetrics{
		AmountByNetwork: make(map[string]*big.Int),
		CountByNetwork:  make(map[string]int),
		FailureReasons:  make(map[string]int),
	}

	// Track seen payment IDs per type for dedup.
	attempted := make(map[string]bool)
	successful := make(map[string]bool)
	failed := make(map[string]bool)

	var verifyLatencies, settleLatencies []int64

	for _, ev := range c.snapshot() {
		switch ev.Type {
		case EventRequested:
			attempted[ev.PaymentID] = true
		case EventCompleted:
			successful[ev.PaymentID] = true
		case EventFailed:
			failed[ev.PaymentID] = true
			if ev.Error != "" {
				m.FailureReasons[ev.Error]++
			}
		case EventVerified:
			if ev.DurationMs > 0 {
				verifyLatencies = append(verifyLatencies, ev.DurationMs)
			}
		case EventSettled:
			if ev.DurationMs > 0 {
				settleLatencies = append(settleLatencies, ev.DurationMs)
			}
		}

		// Accumulate amounts by network for completed events.
		if ev.Type == EventCompleted && ev.Network != "" && ev.Amount != "" {
			amt, ok := new(big.Int).SetString(ev.Amount, 10)
			if ok {
				if m.AmountByNetwork[ev.Network] == nil {
					m.AmountByNetwork[ev.Network] = new(big.Int)
				}
				m.AmountByNetwork[ev.Network].Add(m.AmountByNetwork[ev.Network], amt)
			}
			m.CountByNetwork[ev.Network]++
		}
	}

	m.TotalAttempted = len(attempted)
	m.TotalSuccessful = len(successful)
	m.TotalFailed = len(failed)
	m.AvgVerifyLatencyMs = avg(verifyLatencies)
	m.AvgSettleLatencyMs = avg(settleLatencies)

	return m
}

// Len returns the number of events currently in the buffer.
func (c *Collector) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.count
}

// Clear removes all events from the buffer.
func (c *Collector) Clear() {
	c.mu.Lock()
	c.events = make([]PaymentEvent, c.capacity)
	c.head = 0
	c.count = 0
	c.mu.Unlock()
}

// snapshot returns events in chronological order (oldest first). Caller must hold mu.
func (c *Collector) snapshot() []PaymentEvent {
	if c.count == 0 {
		return nil
	}
	result := make([]PaymentEvent, 0, c.count)
	start := 0
	if c.count == c.capacity {
		start = c.head // oldest element when buffer is full
	}
	for i := 0; i < c.count; i++ {
		idx := (start + i) % c.capacity
		result = append(result, c.events[idx])
	}
	return result
}

func avg(vals []int64) float64 {
	if len(vals) == 0 {
		return 0
	}
	var sum int64
	for _, v := range vals {
		sum += v
	}
	return float64(sum) / float64(len(vals))
}
