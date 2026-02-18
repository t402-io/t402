# Extension: `<name>`

## Summary

Brief description of the extension's purpose and the problem it solves.

## Extension Key

```
<key>
```

## Data Format

### Server Declaration

The server includes this extension in the `extensions` field of the `PaymentRequired` response.

**Info Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field1 | string | Yes | Description |
| field2 | number | No | Description |

**Schema:** JSON Schema that validates the info object.

### Client Payload

The client echoes the extension in the `extensions` field of the `PaymentPayload`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field1 | string | Yes | Description |

## Validation Rules

- Rule 1
- Rule 2

## Security Considerations

- Consideration 1
- Consideration 2

## SDK Implementations

| SDK | Package/Module | Import Path |
|-----|---------------|-------------|
| TypeScript | @t402/extensions | `@t402/extensions/<key>` |
| Go | extensions | `github.com/t402-io/t402/sdks/go/extensions` |

## Examples

### Server-Side

```typescript
// Example server code
```

### Client-Side

```typescript
// Example client code
```
