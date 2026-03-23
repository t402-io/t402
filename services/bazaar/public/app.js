(function() {
  'use strict';

  // ── CAIP-2 to human name mapping ──────────────────────────────
  var NETWORK_NAMES = {
    'eip155:1': 'Ethereum', 'eip155:10': 'Optimism', 'eip155:56': 'BNB Chain',
    'eip155:137': 'Polygon', 'eip155:250': 'Fantom', 'eip155:8453': 'Base',
    'eip155:42161': 'Arbitrum', 'eip155:42170': 'Arbitrum Nova',
    'eip155:43114': 'Avalanche', 'eip155:59144': 'Linea',
    'eip155:324': 'zkSync Era', 'eip155:534352': 'Scroll',
    'eip155:1101': 'Polygon zkEVM', 'eip155:5000': 'Mantle',
    'eip155:7777777': 'Zora', 'eip155:81457': 'Blast',
    'eip155:34443': 'Mode', 'eip155:1135': 'Lisk',
    'eip155:2522': 'Fraxtal', 'eip155:7560': 'Cyber',
    'eip155:1329': 'Sei', 'eip155:252': 'Fraxtal',
    'eip155:169': 'Manta Pacific', 'eip155:204': 'opBNB',
    'eip155:100': 'Gnosis', 'eip155:42220': 'Celo',
    'eip155:1088': 'Metis', 'eip155:167000': 'Taiko',
    'solana:mainnet': 'Solana', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'Solana',
    'ton:mainnet': 'TON', 'tron:mainnet': 'TRON',
    'stellar:pubnet': 'Stellar', 'cosmos:cosmoshub-4': 'Cosmos',
    'aptos:mainnet': 'Aptos', 'near:mainnet': 'NEAR',
    'tezos:mainnet': 'Tezos', 'polkadot:91b171bb158e2d3848fa23a9f1c25182': 'Polkadot',
    'stacks:mainnet': 'Stacks', 'conflux:mainnet': 'Conflux',
    'eip155:8217': 'Kaia', 'eip155:2040': 'Berachain'
  };

  function networkName(caip2) {
    return NETWORK_NAMES[caip2] || caip2;
  }

  // ── Price formatting ──────────────────────────────────────────
  function formatPrice(amount, token) {
    var decimals = 6;
    var raw = parseInt(amount, 10) || 0;
    var value = raw / Math.pow(10, decimals);
    if (value < 0.001 && value > 0) return '<$0.001 ' + token;
    if (value >= 1) return '$' + value.toFixed(2) + ' ' + token;
    if (value >= 0.01) return '$' + value.toFixed(3) + ' ' + token;
    return '$' + value.toFixed(4) + ' ' + token;
  }

  // ── Truncation ────────────────────────────────────────────────
  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
  }

  function truncateAddr(addr) {
    if (!addr || addr.length < 12) return addr || 'unknown';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  // ── DOM helpers ───────────────────────────────────────────────
  var $ = function(sel) { return document.getElementById(sel); };

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'className') e.className = attrs[k];
        else if (k === 'textContent') e.textContent = attrs[k];
        else if (k === 'innerHTML') e.innerHTML = attrs[k];
        else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      children.forEach(function(c) {
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else if (c) e.appendChild(c);
      });
    }
    return e;
  }

  // ── Skeleton loader ───────────────────────────────────────────
  function renderSkeletons(count) {
    var grid = $('service-grid');
    grid.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var card = el('div', { className: 'skeleton-card', 'aria-hidden': 'true' }, [
        el('div', { className: 'skeleton skeleton-title' }),
        el('div', { className: 'skeleton skeleton-desc' }),
        el('div', { className: 'skeleton skeleton-desc2' }),
        el('div', { className: 'skeleton-badges' }, [
          el('div', { className: 'skeleton skeleton-badge' }),
          el('div', { className: 'skeleton skeleton-badge' }),
          el('div', { className: 'skeleton skeleton-badge' })
        ])
      ]);
      grid.appendChild(card);
    }
  }

  // ── Card rendering ────────────────────────────────────────────
  function methodClass(m) {
    return 'badge badge-method badge-method-' + m.toLowerCase();
  }

  function renderCard(svc) {
    var verifiedSvg = svc.verified
      ? '<svg viewBox="0 0 20 20" fill="#22c55e"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>'
      : '<svg viewBox="0 0 20 20" fill="#475569"><circle cx="10" cy="10" r="7" fill="none" stroke="#475569" stroke-width="1.5"/></svg>';

    var detailId = 'detail-' + svc.id;

    var card = el('article', { className: 'card', role: 'listitem' }, [
      el('div', { className: 'card-header' }, [
        el('h2', { className: 'card-title', textContent: svc.name }),
        el('div', {
          className: 'card-verified',
          innerHTML: verifiedSvg,
          title: svc.verified ? 'Verified: returns 402' : 'Not verified',
          'aria-label': svc.verified ? 'Verified service' : 'Unverified service'
        })
      ]),
      el('p', { className: 'card-desc', textContent: truncate(svc.description, 120) }),
      el('div', { className: 'card-meta' }, [
        el('span', { className: 'badge badge-category', textContent: svc.category }),
        el('span', { className: 'badge badge-price', textContent: formatPrice(svc.price.amount, svc.price.token) }),
        el('span', { className: 'badge badge-network', textContent: networkName(svc.price.network) })
      ]),
      el('div', { className: 'card-meta' },
        (svc.methods || []).map(function(m) {
          return el('span', { className: methodClass(m), textContent: m });
        })
      ),
      (svc.tags && svc.tags.length > 0) ? el('div', { className: 'card-tags' },
        svc.tags.slice(0, 8).map(function(t) {
          return el('span', { className: 'tag', textContent: t });
        })
      ) : null,
      el('div', { className: 'card-footer' }, [
        el('span', {
          className: 'card-owner',
          textContent: truncateAddr(svc.owner),
          'data-tooltip': svc.owner,
          title: svc.owner
        }),
        el('button', {
          className: 'btn-details',
          textContent: 'Details',
          'aria-expanded': 'false',
          'aria-controls': detailId,
          onClick: function(e) {
            var panel = document.getElementById(detailId);
            var open = panel.classList.toggle('open');
            e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
            e.currentTarget.textContent = open ? 'Hide' : 'Details';
          }
        })
      ]),
      el('div', { className: 'card-detail', id: detailId }, [
        el('div', { className: 'detail-row' }, [
          el('span', { className: 'detail-label', textContent: 'URL' }),
          el('span', { className: 'detail-value' }, [
            el('a', { href: svc.url, target: '_blank', rel: 'noopener', textContent: svc.url })
          ])
        ]),
        el('div', { className: 'detail-row' }, [
          el('span', { className: 'detail-label', textContent: 'Network' }),
          el('span', { className: 'detail-value', textContent: svc.price.network + ' (' + networkName(svc.price.network) + ')' })
        ]),
        el('div', { className: 'detail-row' }, [
          el('span', { className: 'detail-label', textContent: 'Owner' }),
          el('span', { className: 'detail-value', textContent: svc.owner })
        ]),
        el('div', { className: 'detail-row' }, [
          el('span', { className: 'detail-label', textContent: 'ID' }),
          el('span', { className: 'detail-value', textContent: svc.id })
        ]),
        el('div', { className: 'detail-row' }, [
          el('span', { className: 'detail-label', textContent: 'Registered' }),
          el('span', { className: 'detail-value', textContent: new Date(svc.registeredAt).toLocaleDateString() })
        ])
      ])
    ]);

    return card;
  }

  // ── State ─────────────────────────────────────────────────────
  var allServices = [];
  var statsData = null;

  // ── Render grid ───────────────────────────────────────────────
  function renderGrid(services) {
    var grid = $('service-grid');
    grid.innerHTML = '';

    $('result-count').textContent = services.length + ' service' + (services.length !== 1 ? 's' : '');

    if (services.length === 0) {
      grid.innerHTML = '<div class="empty-state"><h3>No services found</h3><p>Try adjusting your search or filters.</p></div>';
      return;
    }

    services.forEach(function(svc) {
      grid.appendChild(renderCard(svc));
    });
  }

  function renderError(msg) {
    var grid = $('service-grid');
    grid.innerHTML = '';
    var div = el('div', { className: 'error-state' }, [
      el('h3', { textContent: 'Failed to load services' }),
      el('p', { textContent: msg || 'Could not connect to the Bazaar API.' }),
      el('button', { textContent: 'Retry', onClick: init })
    ]);
    grid.appendChild(div);
  }

  // ── Filtering ─────────────────────────────────────────────────
  function applyFilters() {
    var q = ($('search').value || '').toLowerCase().trim();
    var cat = $('filter-category').value;
    var net = $('filter-network').value;
    var tok = $('filter-token').value;

    var filtered = allServices.filter(function(svc) {
      if (cat && svc.category !== cat) return false;
      if (net && svc.price.network !== net) return false;
      if (tok && svc.price.token !== tok) return false;
      if (q) {
        var terms = q.split(/\s+/);
        var haystack = (svc.name + ' ' + svc.description + ' ' + svc.category + ' ' + (svc.tags || []).join(' ')).toLowerCase();
        for (var i = 0; i < terms.length; i++) {
          if (haystack.indexOf(terms[i]) === -1) return false;
        }
      }
      return true;
    });

    renderGrid(filtered);
  }

  // ── Debounce ──────────────────────────────────────────────────
  function debounce(fn, ms) {
    var timer;
    return function() {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  // ── Populate filter dropdowns ─────────────────────────────────
  function populateFilters(categories, networks, tokens) {
    var catSelect = $('filter-category');
    Object.keys(categories).sort().forEach(function(c) {
      catSelect.appendChild(el('option', { value: c, textContent: c + ' (' + categories[c] + ')' }));
    });

    var netSelect = $('filter-network');
    Object.keys(networks).sort().forEach(function(n) {
      netSelect.appendChild(el('option', { value: n, textContent: networkName(n) + ' (' + networks[n] + ')' }));
    });

    var tokSelect = $('filter-token');
    Object.keys(tokens).sort().forEach(function(t) {
      tokSelect.appendChild(el('option', { value: t, textContent: t + ' (' + tokens[t] + ')' }));
    });
  }

  // ── Fetch data ────────────────────────────────────────────────
  function fetchJSON(url) {
    return fetch(url).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function init() {
    renderSkeletons(6);

    Promise.all([
      fetchJSON('/api/v1/search?limit=100'),
      fetchJSON('/api/v1/stats'),
      fetchJSON('/api/v1/categories')
    ]).then(function(results) {
      var searchData = results[0];
      statsData = results[1];
      var catData = results[2];

      allServices = searchData.services || [];

      $('stat-total').textContent = statsData.totalServices || 0;
      $('stat-verified').textContent = statsData.verified || 0;
      $('stat-networks').textContent = Object.keys(statsData.networks || {}).length;
      $('stat-tokens').textContent = Object.keys(statsData.tokens || {}).length;

      populateFilters(catData.categories || {}, statsData.networks || {}, statsData.tokens || {});
      renderGrid(allServices);
    }).catch(function(err) {
      renderError(err.message);
    });
  }

  // ── Event listeners ───────────────────────────────────────────
  $('search').addEventListener('input', debounce(applyFilters, 300));
  $('filter-category').addEventListener('change', applyFilters);
  $('filter-network').addEventListener('change', applyFilters);
  $('filter-token').addEventListener('change', applyFilters);

  $('search').addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      e.target.value = '';
      applyFilters();
    }
  });

  // ── Boot ──────────────────────────────────────────────────────
  init();
})();
