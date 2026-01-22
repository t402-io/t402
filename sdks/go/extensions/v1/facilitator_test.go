package v1

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/t402-io/t402/sdks/go/extensions/types"
)

func TestExtractDiscoveryInfoV1_GETMethod(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":        "http",
				"method":      "GET",
				"discoverable": true,
				"queryParams": map[string]interface{}{
					"query": "string",
					"limit": "number",
				},
			},
			"output": map[string]interface{}{
				"type": "object",
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	require.NotNil(t, info)

	queryInput, ok := info.Input.(types.QueryInput)
	require.True(t, ok)
	assert.Equal(t, "http", queryInput.Type)
	assert.Equal(t, types.MethodGET, queryInput.Method)
	assert.NotEmpty(t, queryInput.QueryParams)
	assert.NotNil(t, info.Output)
}

func TestExtractDiscoveryInfoV1_POSTMethod(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":       "http",
				"method":     "POST",
				"bodyType":   "json",
				"bodyFields": map[string]interface{}{
					"name":  "string",
					"email": "string",
				},
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	require.NotNil(t, info)

	bodyInput, ok := info.Input.(types.BodyInput)
	require.True(t, ok)
	assert.Equal(t, "http", bodyInput.Type)
	assert.Equal(t, types.MethodPOST, bodyInput.Method)
	assert.Equal(t, types.BodyTypeJSON, bodyInput.BodyType)
	assert.NotNil(t, bodyInput.Body)
}

func TestExtractDiscoveryInfoV1_WithHeaders(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":   "http",
				"method": "GET",
				"headers": map[string]interface{}{
					"Authorization": "Bearer token",
				},
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	require.NotNil(t, info)

	queryInput, ok := info.Input.(types.QueryInput)
	require.True(t, ok)
	assert.NotEmpty(t, queryInput.Headers)
	assert.Equal(t, "Bearer token", queryInput.Headers["Authorization"])
}

func TestExtractDiscoveryInfoV1_NotDiscoverable(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":        "http",
				"method":      "GET",
				"discoverable": false,
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	assert.Nil(t, info)
}

func TestExtractDiscoveryInfoV1_NoOutputSchema(t *testing.T) {
	requirements := map[string]interface{}{
		"amount": "100",
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	assert.Nil(t, info)
}

func TestExtractDiscoveryInfoV1_InvalidInputType(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":   "websocket", // Not "http"
				"method": "GET",
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	assert.Nil(t, info)
}

func TestExtractDiscoveryInfoV1_NoMethod(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type": "http",
				// method missing
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	assert.Nil(t, info)
}

func TestExtractDiscoveryInfoV1_UnsupportedMethod(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":   "http",
				"method": "OPTIONS", // Unsupported
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	assert.Nil(t, info)
}

func TestExtractDiscoveryInfoV1_Struct(t *testing.T) {
	type Requirements struct {
		OutputSchema struct {
			Input struct {
				Type   string `json:"type"`
				Method string `json:"method"`
			} `json:"input"`
		} `json:"outputSchema"`
	}

	requirements := Requirements{
		OutputSchema: struct {
			Input struct {
				Type   string `json:"type"`
				Method string `json:"method"`
			} `json:"input"`
		}{
			Input: struct {
				Type   string `json:"type"`
				Method string `json:"method"`
			}{
				Type:   "http",
				Method: "DELETE",
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	require.NotNil(t, info)

	queryInput, ok := info.Input.(types.QueryInput)
	require.True(t, ok)
	assert.Equal(t, types.MethodDELETE, queryInput.Method)
}

func TestExtractDiscoveryInfoV1_BodyTypeFormData(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":       "http",
				"method":     "POST",
				"bodyType":   "form-data",
				"bodyFields": map[string]interface{}{"file": "binary"},
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	require.NotNil(t, info)

	bodyInput, ok := info.Input.(types.BodyInput)
	require.True(t, ok)
	assert.Equal(t, types.BodyTypeFormData, bodyInput.BodyType)
}

func TestExtractDiscoveryInfoV1_BodyTypeText(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":     "http",
				"method":   "PUT",
				"bodyType": "text",
				"body":     "raw text content",
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	require.NotNil(t, info)

	bodyInput, ok := info.Input.(types.BodyInput)
	require.True(t, ok)
	assert.Equal(t, types.BodyTypeText, bodyInput.BodyType)
}

func TestExtractDiscoveryInfoV1_SnakeCaseFields(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":         "http",
				"method":       "GET",
				"query_params": map[string]interface{}{"q": "search"},
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	require.NotNil(t, info)

	queryInput, ok := info.Input.(types.QueryInput)
	require.True(t, ok)
	assert.NotEmpty(t, queryInput.QueryParams)
}

func TestExtractDiscoveryInfoV1_HeaderFields(t *testing.T) {
	requirements := map[string]interface{}{
		"outputSchema": map[string]interface{}{
			"input": map[string]interface{}{
				"type":   "http",
				"method": "GET",
				"headerFields": map[string]interface{}{
					"X-Custom-Header": map[string]interface{}{"type": "string"},
				},
			},
		},
	}

	info, err := ExtractDiscoveryInfoV1(requirements)
	require.NoError(t, err)
	require.NotNil(t, info)

	queryInput, ok := info.Input.(types.QueryInput)
	require.True(t, ok)
	_, hasHeader := queryInput.Headers["X-Custom-Header"]
	assert.True(t, hasHeader)
}

func TestIsDiscoverableV1(t *testing.T) {
	t.Run("Discoverable", func(t *testing.T) {
		requirements := map[string]interface{}{
			"outputSchema": map[string]interface{}{
				"input": map[string]interface{}{
					"type":   "http",
					"method": "GET",
				},
			},
		}
		assert.True(t, IsDiscoverableV1(requirements))
	})

	t.Run("Not Discoverable", func(t *testing.T) {
		requirements := map[string]interface{}{
			"amount": "100",
		}
		assert.False(t, IsDiscoverableV1(requirements))
	})

	t.Run("Explicitly Not Discoverable", func(t *testing.T) {
		requirements := map[string]interface{}{
			"outputSchema": map[string]interface{}{
				"input": map[string]interface{}{
					"type":        "http",
					"method":      "GET",
					"discoverable": false,
				},
			},
		}
		assert.False(t, IsDiscoverableV1(requirements))
	})
}

func TestExtractResourceMetadataV1(t *testing.T) {
	t.Run("Full metadata", func(t *testing.T) {
		requirements := map[string]interface{}{
			"resource":    "https://api.example.com/resource",
			"description": "Test resource",
			"mimeType":    "application/json",
		}

		metadata := ExtractResourceMetadataV1(requirements)
		assert.Equal(t, "https://api.example.com/resource", metadata["url"])
		assert.Equal(t, "Test resource", metadata["description"])
		assert.Equal(t, "application/json", metadata["mimeType"])
	})

	t.Run("Partial metadata", func(t *testing.T) {
		requirements := map[string]interface{}{
			"resource": "https://api.example.com/resource",
		}

		metadata := ExtractResourceMetadataV1(requirements)
		assert.Equal(t, "https://api.example.com/resource", metadata["url"])
		assert.Empty(t, metadata["description"])
		assert.Empty(t, metadata["mimeType"])
	})

	t.Run("Empty requirements", func(t *testing.T) {
		requirements := map[string]interface{}{}

		metadata := ExtractResourceMetadataV1(requirements)
		assert.Empty(t, metadata)
	})

	t.Run("Struct requirements", func(t *testing.T) {
		type Requirements struct {
			Resource    string `json:"resource"`
			Description string `json:"description"`
		}

		requirements := Requirements{
			Resource:    "https://api.example.com/data",
			Description: "Data endpoint",
		}

		metadata := ExtractResourceMetadataV1(requirements)
		assert.Equal(t, "https://api.example.com/data", metadata["url"])
		assert.Equal(t, "Data endpoint", metadata["description"])
	})
}

func TestExtractQueryParams(t *testing.T) {
	t.Run("queryParams field", func(t *testing.T) {
		input := map[string]interface{}{
			"queryParams": map[string]interface{}{"q": "test"},
		}
		params := extractQueryParams(input)
		assert.NotNil(t, params)
		assert.Equal(t, "test", params["q"])
	})

	t.Run("query field", func(t *testing.T) {
		input := map[string]interface{}{
			"query": map[string]interface{}{"search": "value"},
		}
		params := extractQueryParams(input)
		assert.NotNil(t, params)
		assert.Equal(t, "value", params["search"])
	})

	t.Run("params field", func(t *testing.T) {
		input := map[string]interface{}{
			"params": map[string]interface{}{"id": "123"},
		}
		params := extractQueryParams(input)
		assert.NotNil(t, params)
		assert.Equal(t, "123", params["id"])
	})

	t.Run("no params", func(t *testing.T) {
		input := map[string]interface{}{}
		params := extractQueryParams(input)
		assert.Nil(t, params)
	})
}

func TestExtractBodyInfo(t *testing.T) {
	t.Run("bodyFields", func(t *testing.T) {
		input := map[string]interface{}{
			"bodyType":   "json",
			"bodyFields": map[string]interface{}{"name": "test"},
		}
		body, bodyType := extractBodyInfo(input)
		assert.Equal(t, types.BodyTypeJSON, bodyType)
		assert.NotNil(t, body)
	})

	t.Run("body field", func(t *testing.T) {
		input := map[string]interface{}{
			"body": map[string]interface{}{"data": "value"},
		}
		body, bodyType := extractBodyInfo(input)
		assert.Equal(t, types.BodyTypeJSON, bodyType) // Default
		bodyMap, ok := body.(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "value", bodyMap["data"])
	})

	t.Run("data field", func(t *testing.T) {
		input := map[string]interface{}{
			"data": []string{"item1", "item2"},
		}
		body, _ := extractBodyInfo(input)
		assert.NotNil(t, body)
	})

	t.Run("properties field", func(t *testing.T) {
		input := map[string]interface{}{
			"properties": map[string]interface{}{"prop": "value"},
		}
		body, _ := extractBodyInfo(input)
		assert.NotNil(t, body)
	})
}

func TestNormalizeBodyType(t *testing.T) {
	tests := []struct {
		input    string
		expected types.BodyType
	}{
		{"json", types.BodyTypeJSON},
		{"JSON", types.BodyTypeJSON},
		{"application/json", types.BodyTypeJSON},
		{"form-data", types.BodyTypeFormData},
		{"multipart/form-data", types.BodyTypeFormData},
		{"multipart", types.BodyTypeFormData},
		{"text", types.BodyTypeText},
		{"text/plain", types.BodyTypeText},
		{"plain", types.BodyTypeText},
		{"unknown", types.BodyTypeJSON}, // Default
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := normalizeBodyType(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}
