package registry

import "locail/internal/ports"

type Registry struct{ byFormat map[string]ports.Exporter }

func New() *Registry { return &Registry{byFormat: map[string]ports.Exporter{}} }

func (r *Registry) Register(e ports.Exporter) { r.byFormat[e.Format()] = e }

func (r *Registry) Get(format string) (ports.Exporter, bool) { e, ok := r.byFormat[format]; return e, ok }

