# Similar Products API

Given a product, return the products similar to it.

```
GET /product/{productId}/similar      (port 5000)
```

The response is the full detail of each similar product, ordered from most to least similar.

## How it works

The service owns no product data. It combines two calls to an existing upstream API:

```
client ──GET /product/1/similar──▶ this service
                                     │
                                     ├─ 1. GET /product/1/similarids   → [2, 3, 4]
                                     ├─ 2. GET /product/2  ┐
                                     │     GET /product/3  ├ in parallel
                                     │     GET /product/4  ┘
                                     ▼
client ◀──── [ {id: 2, ...}, {id: 3, ...}, {id: 4, ...} ]
```

- Response contract: [`similarProducts.yaml`](./similarProducts.yaml)
- Upstream APIs: [`existingApis.yaml`](./existingApis.yaml)

## Quick start

Requires Node 22+.

```
npm ci
npm run dev              # watch mode, port 5000
```

Other commands:

```
npm test
npm run test:coverage
npm run build && npm start
```

### Configuration

All settings come from environment variables and have defaults.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `UPSTREAM_BASE_URL` | `http://localhost:3001` | Base URL of the existing APIs |
| `UPSTREAM_TIMEOUT_MS` | `2000` | Timeout per upstream call |
| `CACHE_TTL_MS` | `60000` | How long successful results (and "not found") are cached |
| `CACHE_MAX_ENTRIES` | `10000` | Maximum entries per cache (least recently used are evicted) |
| `CACHE_FAILURE_TTL_MS` | `5000` | How long a failed upstream call is remembered |

### Performance test

```
docker-compose up -d simulado influxdb grafana
npm run dev
docker-compose run --rm k6 run scripts/test.js
```

Open the results in Grafana: [http://localhost:3000/d/Le2Ku9NMk/k6-performance-test](http://localhost:3000/d/Le2Ku9NMk/k6-performance-test).

## Architecture

Hexagonal, kept minimal.

```
src/
  domain/            ProductDetail, ProductNotFoundError, UpstreamUnavailableError
  application/       ProductCatalog port, GetSimilarProducts use case
  adapters/
    inbound/http/    Fastify route, domain error -> HTTP status
    outbound/        HttpProductCatalog (fetch + timeout), CachedProductCatalog (decorator)
  config.ts          environment -> typed settings
  main.ts            composition root, graceful shutdown
```

- Dependencies point inwards: `domain` ← `application` ← `adapters`.
- `domain` and `application` import nothing from Fastify, `fetch` or `lru-cache`.
- The cache wraps the HTTP catalog behind the same `ProductCatalog` port, so the use case does not know it exists.

## Failure handling

| Situation | Response |
|---|---|
| Similar ids return 404 | `404` |
| Similar ids fail or time out | `503` (nothing can be answered) |
| A single product detail fails, times out or returns 404 | That product is omitted, `200` with the rest |
| Every product detail fails | `200 []` |
| Duplicate similar ids | De-duplicated (contract: `uniqueItems`) |

Errors always have the shape `{ "message": string }`.

The contract only declares `200` and `404`. `503` is a deliberate addition so clients can tell "unknown product" apart from "try again later".

## Decisions and trade-offs

### Timeout: 2 s per upstream call

`AbortSignal.timeout` aborts the request, so the socket is released instead of left hanging on the 5 s and 50 s mock delays.

### Cache

- Similar ids and product details are cached for 60 s, including "not found".
- The cache stores the promise, not the value, so concurrent requests for the same id share one upstream call.
- Size is bounded with `lru-cache`.

### Failure cache

A failed call stays cached for 5 s, so a permanently slow product costs one timeout per 5 s window instead of one per request.

**Cost:** a product that recovers stays omitted for up to 5 s.

### No circuit breaker

The failure cache already fails fast per product. A single breaker for the whole upstream would let a few permanently slow products (1000 and 10000 in the mocks) block healthy ones.

**Cost:** during a full upstream outage spread over many uncached products, each new product still pays one timeout per window.

### No retries

Retries amplify load on an upstream that is already struggling. The short timeout plus the failure cache cover the same ground.

### Node.js + Fastify instead of Spring Boot

The brief asks for Spring Boot. This service is pure I/O fan-out, which suits Node's event loop:

- native `fetch` with keep-alive and `AbortSignal.timeout` needs no HTTP client library;
- Fastify adds little overhead under 200 concurrent users.

The architecture maps one-to-one onto a Spring WebFlux implementation.

### Out of scope

Stale-while-error, circuit breaker, metrics and tracing, Dockerfile, authentication, rate limiting.

## Results

### Functional

Expected responses against the provided mocks, verified manually:

| Product | Upstream ids | Response | Why |
|---|---|---|---|
| 1 | 2, 3, 4 | `[2, 3, 4]` | 3 is delayed 100 ms, within the timeout |
| 2 | 3, 100, 1000 | `[3, 100]` | 1000 takes 5 s and times out |
| 3 | 100, 1000, 10000 | `[100]` | 1000 and 10000 time out |
| 4 | 1, 2, 5 | `[1, 2]` | 5 returns 404 |
| 5 | 1, 2, 6 | `[1, 2]` | 6 returns 500 |
| unknown | - | `404` | similar ids return 404 |

### Load (k6)

All five scenarios at 200 virtual users, before and after adding the failure cache:

| Metric | Without failure cache | With failure cache | Change |
|---|---|---|---|
| Completed iterations | 13 000 | 16 200 | |
| Requests per second | 226 | 279 | +23 % |
| Median latency | 9.4 ms | 7.2 ms | |
| p90 latency | 1.99 s | 29.8 ms | −98 % |
| p95 latency | 2.02 s | 172 ms | −91 % |
| Max latency | 2.06 s | 2.05 s | |
