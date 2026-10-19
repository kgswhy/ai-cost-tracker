# Vendor C Usage API

Vendor C exposes usage records through a REST API. A local mock of this API is provided in `vendor-c-mock/`.

## Running the mock

Requires Node.js 18 or later. No dependencies need to be installed.

```bash
node vendor-c-mock/server.js
```

The API listens on `http://localhost:4010`. Set the `PORT` environment variable to use a different port.

## Authentication

Every request must include an API key in the `Authorization` header:

```
Authorization: Bearer vc_test_7Kq2mX9pL4
```

Requests with a missing or invalid key receive `401 Unauthorized`.

## Endpoints

### `GET /v1/usage`

Returns usage records, oldest first, one page at a time.

| Query parameter | Type    | Default | Description                                  |
|-----------------|---------|---------|----------------------------------------------|
| `page`          | integer | `1`     | Page number, starting at 1.                  |
| `per_page`      | integer | `25`    | Records per page. Maximum `100`.             |

**Example request**

```bash
curl -H "Authorization: Bearer vc_test_7Kq2mX9pL4" "http://localhost:4010/v1/usage?page=1&per_page=2"
```

**Example response**

```json
{
  "data": [
    {
      "id": "vc_30147",
      "created_at": "2026-08-31T01:18:32Z",
      "project": "glw-03",
      "service": "sfx.generate",
      "amount_usd_cents": 3455
    },
    {
      "id": "vc_30278",
      "created_at": "2026-08-31T08:36:43Z",
      "project": "int-00",
      "service": "music.generate",
      "amount_usd_cents": 2950
    }
  ],
  "page": 1,
  "per_page": 2,
  "total": 103,
  "has_more": true
}
```

### Record fields

| Field              | Type    | Description                                              |
|--------------------|---------|----------------------------------------------------------|
| `id`               | string  | Unique, stable record identifier.                        |
| `created_at`       | string  | ISO 8601 timestamp in UTC.                               |
| `project`          | string  | Project label entered by the user who ran the job.       |
| `service`          | string  | The Vendor C service that was used.                      |
| `amount_usd_cents` | integer | Cost of the job in US cents.                             |

### `GET /health`

Returns `{"status": "ok"}`. Does not require authentication.

## Errors

| Status | Meaning                                                                  |
|--------|--------------------------------------------------------------------------|
| `400`  | Invalid query parameters.                                                |
| `401`  | Missing or invalid API key.                                              |
| `429`  | Rate limit exceeded. Wait for the number of seconds in `Retry-After`.    |
| `5xx`  | Temporary server error. The request can be retried.                      |

Like the real Vendor C API, the mock enforces rate limits and occasionally returns server errors.
