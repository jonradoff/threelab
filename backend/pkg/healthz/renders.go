package healthz

import (
	"sync"
	"time"
)

// RenderTracker tracks distinct pattern renders in a rolling 24-hour window.
type RenderTracker struct {
	mu      sync.Mutex
	events  []renderEvent
	window  time.Duration
}

type renderEvent struct {
	pattern string
	at      time.Time
}

// NewRenderTracker creates a tracker with a 24-hour rolling window.
func NewRenderTracker() *RenderTracker {
	return &RenderTracker{
		window: 24 * time.Hour,
	}
}

// Record logs a render of the given pattern type.
func (rt *RenderTracker) Record(pattern string) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	rt.events = append(rt.events, renderEvent{pattern: pattern, at: time.Now()})
}

// Count returns the number of distinct patterns rendered in the last 24 hours.
func (rt *RenderTracker) Count() int {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	cutoff := time.Now().Add(-rt.window)

	// Prune old events
	fresh := rt.events[:0]
	for _, e := range rt.events {
		if e.at.After(cutoff) {
			fresh = append(fresh, e)
		}
	}
	rt.events = fresh

	// Count distinct patterns
	seen := make(map[string]struct{})
	for _, e := range rt.events {
		seen[e.pattern] = struct{}{}
	}
	return len(seen)
}

// TotalRenders returns the total number of render events in the last 24 hours.
func (rt *RenderTracker) TotalRenders() int {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	cutoff := time.Now().Add(-rt.window)
	count := 0
	for _, e := range rt.events {
		if e.at.After(cutoff) {
			count++
		}
	}
	return count
}
