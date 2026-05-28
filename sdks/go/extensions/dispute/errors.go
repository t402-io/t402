package dispute

import "errors"

// ErrJWSReserved is returned when callers attempt JWS-format operations.
// JWS support is reserved for a future spec revision.
var ErrJWSReserved = errors.New("dispute: JWS format is reserved for future spec; only EIP-712 is supported")
