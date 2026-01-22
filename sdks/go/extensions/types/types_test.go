package types

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConstants(t *testing.T) {
	assert.Equal(t, "bazaar", BAZAAR)
}

func TestQueryParamMethods(t *testing.T) {
	assert.Equal(t, QueryParamMethods("GET"), MethodGET)
	assert.Equal(t, QueryParamMethods("HEAD"), MethodHEAD)
	assert.Equal(t, QueryParamMethods("DELETE"), MethodDELETE)
}

func TestBodyMethods(t *testing.T) {
	assert.Equal(t, BodyMethods("POST"), MethodPOST)
	assert.Equal(t, BodyMethods("PUT"), MethodPUT)
	assert.Equal(t, BodyMethods("PATCH"), MethodPATCH)
}

func TestBodyTypes(t *testing.T) {
	assert.Equal(t, BodyType("json"), BodyTypeJSON)
	assert.Equal(t, BodyType("form-data"), BodyTypeFormData)
	assert.Equal(t, BodyType("text"), BodyTypeText)
}

func TestIsQueryMethod(t *testing.T) {
	tests := []struct {
		method string
		want   bool
	}{
		{"GET", true},
		{"HEAD", true},
		{"DELETE", true},
		{"POST", false},
		{"PUT", false},
		{"PATCH", false},
		{"OPTIONS", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			got := IsQueryMethod(tt.method)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestIsBodyMethod(t *testing.T) {
	tests := []struct {
		method string
		want   bool
	}{
		{"POST", true},
		{"PUT", true},
		{"PATCH", true},
		{"GET", false},
		{"HEAD", false},
		{"DELETE", false},
		{"OPTIONS", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			got := IsBodyMethod(tt.method)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestQueryInputJSON(t *testing.T) {
	input := QueryInput{
		Type:   "http",
		Method: MethodGET,
		QueryParams: map[string]interface{}{
			"query": "test",
			"limit": 10,
		},
		Headers: map[string]string{
			"Authorization": "Bearer token",
		},
	}

	data, err := json.Marshal(input)
	require.NoError(t, err)

	var decoded QueryInput
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "http", decoded.Type)
	assert.Equal(t, MethodGET, decoded.Method)
	assert.NotEmpty(t, decoded.QueryParams)
	assert.NotEmpty(t, decoded.Headers)
}

func TestBodyInputJSON(t *testing.T) {
	input := BodyInput{
		Type:     "http",
		Method:   MethodPOST,
		BodyType: BodyTypeJSON,
		Body: map[string]interface{}{
			"name": "test",
		},
		QueryParams: map[string]interface{}{
			"version": "1",
		},
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}

	data, err := json.Marshal(input)
	require.NoError(t, err)

	var decoded BodyInput
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "http", decoded.Type)
	assert.Equal(t, MethodPOST, decoded.Method)
	assert.Equal(t, BodyTypeJSON, decoded.BodyType)
	assert.NotNil(t, decoded.Body)
}

func TestOutputInfoJSON(t *testing.T) {
	output := OutputInfo{
		Type:   "json",
		Format: "application/json",
		Example: map[string]interface{}{
			"result": "success",
		},
	}

	data, err := json.Marshal(output)
	require.NoError(t, err)

	var decoded OutputInfo
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "json", decoded.Type)
	assert.Equal(t, "application/json", decoded.Format)
	assert.NotNil(t, decoded.Example)
}

func TestDiscoveryInfoUnmarshalJSON_QueryInput(t *testing.T) {
	jsonData := `{
		"input": {
			"type": "http",
			"method": "GET",
			"queryParams": {"search": "test"}
		},
		"output": {
			"type": "json",
			"example": {"data": []}
		}
	}`

	var info DiscoveryInfo
	err := json.Unmarshal([]byte(jsonData), &info)
	require.NoError(t, err)

	// Should be parsed as QueryInput (no bodyType field)
	queryInput, ok := info.Input.(QueryInput)
	require.True(t, ok)
	assert.Equal(t, "http", queryInput.Type)
	assert.Equal(t, MethodGET, queryInput.Method)
	assert.NotNil(t, info.Output)
	assert.Equal(t, "json", info.Output.Type)
}

func TestDiscoveryInfoUnmarshalJSON_BodyInput(t *testing.T) {
	jsonData := `{
		"input": {
			"type": "http",
			"method": "POST",
			"bodyType": "json",
			"body": {"name": "test"}
		}
	}`

	var info DiscoveryInfo
	err := json.Unmarshal([]byte(jsonData), &info)
	require.NoError(t, err)

	// Should be parsed as BodyInput (has bodyType field)
	bodyInput, ok := info.Input.(BodyInput)
	require.True(t, ok)
	assert.Equal(t, "http", bodyInput.Type)
	assert.Equal(t, MethodPOST, bodyInput.Method)
	assert.Equal(t, BodyTypeJSON, bodyInput.BodyType)
}

func TestDiscoveryInfoUnmarshalJSON_InvalidJSON(t *testing.T) {
	jsonData := `invalid json`

	var info DiscoveryInfo
	err := json.Unmarshal([]byte(jsonData), &info)
	assert.Error(t, err)
}

func TestQueryDiscoveryInfoJSON(t *testing.T) {
	info := QueryDiscoveryInfo{
		Input: QueryInput{
			Type:   "http",
			Method: MethodGET,
		},
		Output: &OutputInfo{
			Type: "json",
		},
	}

	data, err := json.Marshal(info)
	require.NoError(t, err)

	var decoded QueryDiscoveryInfo
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "http", decoded.Input.Type)
	assert.NotNil(t, decoded.Output)
}

func TestBodyDiscoveryInfoJSON(t *testing.T) {
	info := BodyDiscoveryInfo{
		Input: BodyInput{
			Type:     "http",
			Method:   MethodPOST,
			BodyType: BodyTypeJSON,
		},
		Output: &OutputInfo{
			Type: "json",
		},
	}

	data, err := json.Marshal(info)
	require.NoError(t, err)

	var decoded BodyDiscoveryInfo
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, MethodPOST, decoded.Input.Method)
	assert.Equal(t, BodyTypeJSON, decoded.Input.BodyType)
}

func TestDiscoveryExtensionJSON(t *testing.T) {
	ext := DiscoveryExtension{
		Schema: JSONSchema{
			"type": "object",
			"properties": map[string]interface{}{
				"query": map[string]interface{}{"type": "string"},
			},
		},
	}

	data, err := json.Marshal(ext)
	require.NoError(t, err)

	var decoded DiscoveryExtension
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.NotEmpty(t, decoded.Schema)
}

func TestJSONSchemaType(t *testing.T) {
	schema := JSONSchema{
		"type": "object",
		"properties": map[string]interface{}{
			"name": map[string]interface{}{"type": "string"},
			"age":  map[string]interface{}{"type": "integer"},
		},
		"required": []string{"name"},
	}

	data, err := json.Marshal(schema)
	require.NoError(t, err)

	var decoded JSONSchema
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "object", decoded["type"])
	assert.NotNil(t, decoded["properties"])
}

func TestOutputConfig(t *testing.T) {
	config := OutputConfig{
		Example: map[string]interface{}{"success": true},
		Schema: JSONSchema{
			"type": "object",
		},
	}

	assert.NotNil(t, config.Example)
	assert.NotNil(t, config.Schema)
}

func TestDeclareQueryDiscoveryConfig(t *testing.T) {
	config := DeclareQueryDiscoveryConfig{
		Method: MethodGET,
		Input: map[string]interface{}{
			"query": "search term",
		},
		InputSchema: JSONSchema{
			"type": "object",
		},
		Output: &OutputConfig{
			Example: []string{"result1", "result2"},
		},
	}

	assert.Equal(t, MethodGET, config.Method)
	assert.NotEmpty(t, config.Input)
	assert.NotNil(t, config.Output)
}

func TestDeclareBodyDiscoveryConfig(t *testing.T) {
	config := DeclareBodyDiscoveryConfig{
		Method:   MethodPOST,
		Input:    map[string]interface{}{"name": "test"},
		BodyType: BodyTypeJSON,
		InputSchema: JSONSchema{
			"type": "object",
		},
		Output: &OutputConfig{
			Example: map[string]interface{}{"id": 123},
		},
	}

	assert.Equal(t, MethodPOST, config.Method)
	assert.Equal(t, BodyTypeJSON, config.BodyType)
	assert.NotNil(t, config.Input)
	assert.NotNil(t, config.Output)
}
