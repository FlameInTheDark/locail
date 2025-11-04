package registry

import "locail/internal/ports"

type Registry struct {
    byFormat map[string]ports.Parser
}

func New() *Registry { return &Registry{byFormat: map[string]ports.Parser{}} }

func (r *Registry) Register(p ports.Parser) { r.byFormat[p.Format()] = p }

func (r *Registry) Get(format string) (ports.Parser, bool) { p, ok := r.byFormat[format]; return p, ok }

