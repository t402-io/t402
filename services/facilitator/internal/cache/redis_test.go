package cache

import (
	"testing"
)

func TestParseRedisURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		wantAddr string
		wantUser string
		wantPass string
		wantErr  bool
	}{
		{
			name:     "simple URL",
			url:      "redis://localhost:6379",
			wantAddr: "localhost:6379",
			wantUser: "",
			wantPass: "",
			wantErr:  false,
		},
		{
			name:     "with password",
			url:      "redis://user:pass@localhost:6379",
			wantAddr: "localhost:6379",
			wantUser: "user",
			wantPass: "pass",
			wantErr:  false,
		},
		{
			name:     "with username only",
			url:      "redis://user@localhost:6379",
			wantAddr: "localhost:6379",
			wantUser: "user",
			wantPass: "",
			wantErr:  false,
		},
		{
			name:     "custom port",
			url:      "redis://redis.example.com:6380",
			wantAddr: "redis.example.com:6380",
			wantUser: "",
			wantPass: "",
			wantErr:  false,
		},
		{
			name:    "invalid URL",
			url:     "://invalid",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts, err := parseRedisURL(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if opts.Addr != tt.wantAddr {
				t.Errorf("Addr = %s, want %s", opts.Addr, tt.wantAddr)
			}
			if opts.Username != tt.wantUser {
				t.Errorf("Username = %s, want %s", opts.Username, tt.wantUser)
			}
			if opts.Password != tt.wantPass {
				t.Errorf("Password = %s, want %s", opts.Password, tt.wantPass)
			}
		})
	}
}

func TestParseRedisURL_EdgeCases(t *testing.T) {
	// Empty password (password separator present but no password)
	opts, err := parseRedisURL("redis://user:@localhost:6379")
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if opts.Username != "user" {
		t.Errorf("Username = %s, want user", opts.Username)
	}
	if opts.Password != "" {
		t.Errorf("Password = %s, want empty", opts.Password)
	}
}

// Note: NewClient and the other methods require a real Redis connection to test.
// For integration testing with Redis, consider using a test Redis container.

func TestParseRedisURL_SpecialCharacters(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		wantAddr string
		wantUser string
		wantPass string
		wantErr  bool
	}{
		{
			name:     "password with special chars",
			url:      "redis://user:p%40ss%3Aword@localhost:6379",
			wantAddr: "localhost:6379",
			wantUser: "user",
			wantPass: "p@ss:word",
			wantErr:  false,
		},
		{
			name:     "ipv4 address",
			url:      "redis://192.168.1.100:6379",
			wantAddr: "192.168.1.100:6379",
			wantUser: "",
			wantPass: "",
			wantErr:  false,
		},
		{
			name:     "no port",
			url:      "redis://localhost",
			wantAddr: "localhost",
			wantUser: "",
			wantPass: "",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts, err := parseRedisURL(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if opts.Addr != tt.wantAddr {
				t.Errorf("Addr = %s, want %s", opts.Addr, tt.wantAddr)
			}
			if opts.Username != tt.wantUser {
				t.Errorf("Username = %s, want %s", opts.Username, tt.wantUser)
			}
			if opts.Password != tt.wantPass {
				t.Errorf("Password = %s, want %s", opts.Password, tt.wantPass)
			}
		})
	}
}

func TestParseRedisURL_Scheme(t *testing.T) {
	// Test different schemes
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"redis scheme", "redis://localhost:6379", false},
		{"rediss scheme", "rediss://localhost:6379", false},
		{"http scheme (still parses)", "http://localhost:6379", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseRedisURL(tt.url)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error but got nil")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestParseRedisURL_EmptyURL(t *testing.T) {
	opts, err := parseRedisURL("")
	if err != nil {
		t.Errorf("Unexpected error for empty URL: %v", err)
	}
	if opts.Addr != "" {
		t.Errorf("Expected empty Addr for empty URL, got %s", opts.Addr)
	}
}

func TestParseRedisURL_PathIgnored(t *testing.T) {
	// Redis URLs typically include a database number in the path
	opts, err := parseRedisURL("redis://localhost:6379/0")
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if opts.Addr != "localhost:6379" {
		t.Errorf("Addr = %s, want localhost:6379", opts.Addr)
	}
	// Note: The current implementation doesn't parse the database number from path
	// This test documents current behavior
}
