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
