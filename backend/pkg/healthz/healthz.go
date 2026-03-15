// Package healthz provides a standardized health check endpoint
// compatible with the VibeCtl Health Check Protocol.
package healthz

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// Status represents the overall health state.
type Status string

const (
	StatusHealthy   Status = "healthy"
	StatusDegraded  Status = "degraded"
	StatusUnhealthy Status = "unhealthy"
)

// Dependency represents a service dependency's health.
type Dependency struct {
	Name    string `json:"name"`
	Status  Status `json:"status"`
	Message string `json:"message,omitempty"`
}

// KPI represents a key performance indicator.
type KPI struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
}

// HealthResponse is the standard response from a /healthz endpoint.
type HealthResponse struct {
	Status       Status       `json:"status"`
	Version      string       `json:"version,omitempty"`
	Uptime       int          `json:"uptime"`
	Dependencies []Dependency `json:"dependencies"`
	KPIs         []KPI        `json:"kpis"`
}

// CheckFunc checks a dependency. Return nil if healthy, an error if unhealthy.
type CheckFunc func() error

// KPIFunc returns the current KPIs.
type KPIFunc func() []KPI

// Handler creates an http.HandlerFunc that serves the /healthz endpoint.
func Handler(version string, checks map[string]CheckFunc, kpis KPIFunc) http.HandlerFunc {
	start := time.Now()

	return func(w http.ResponseWriter, r *http.Request) {
		resp := HealthResponse{
			Status:       StatusHealthy,
			Version:      version,
			Uptime:       int(time.Since(start).Seconds()),
			Dependencies: []Dependency{},
			KPIs:         []KPI{},
		}

		// Check dependencies concurrently
		if len(checks) > 0 {
			var mu sync.Mutex
			var wg sync.WaitGroup
			for name, check := range checks {
				wg.Add(1)
				go func(n string, c CheckFunc) {
					defer wg.Done()
					dep := Dependency{Name: n, Status: StatusHealthy}
					if err := c(); err != nil {
						dep.Status = StatusUnhealthy
						dep.Message = err.Error()
					}
					mu.Lock()
					resp.Dependencies = append(resp.Dependencies, dep)
					mu.Unlock()
				}(name, check)
			}
			wg.Wait()

			for _, d := range resp.Dependencies {
				if d.Status == StatusUnhealthy {
					resp.Status = StatusUnhealthy
					break
				}
				if d.Status == StatusDegraded && resp.Status == StatusHealthy {
					resp.Status = StatusDegraded
				}
			}
		}

		if kpis != nil {
			resp.KPIs = kpis()
			if resp.KPIs == nil {
				resp.KPIs = []KPI{}
			}
		}

		code := http.StatusOK
		if resp.Status == StatusUnhealthy {
			code = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		json.NewEncoder(w).Encode(resp)
	}
}
