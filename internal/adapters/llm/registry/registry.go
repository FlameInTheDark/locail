package registry

import (
	"context"
	"errors"
	"locail/internal/ports"
	"sync"
)

// Registry holds named Provider implementations.
type Registry struct {
	mu        sync.RWMutex
	providers map[string]ports.Provider
}

func New() *Registry {
	return &Registry{providers: make(map[string]ports.Provider)}
}

func (r *Registry) Register(name string, p ports.Provider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[name] = p
}

func (r *Registry) Get(name string) (ports.Provider, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[name]
	return p, ok
}

func (r *Registry) MustGet(name string) ports.Provider {
	if p, ok := r.Get(name); ok {
		return p
	}
	panic("provider not registered: " + name)
}

// HealthCheck tests all providers (used by Settings UI).
func (r *Registry) HealthCheck(ctx context.Context) map[string]error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make(map[string]error, len(r.providers))
	for name, p := range r.providers {
		if p == nil {
			out[name] = errors.New("nil provider")
			continue
		}
		out[name] = p.Test(ctx)
	}
	return out
}
