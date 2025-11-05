package factory

import (
	httpprov "locail/internal/adapters/llm/httpclient"
	"locail/internal/domain"
	"locail/internal/ports"
)

// FromProvider returns an HTTP-backed provider for the given record.
func FromProvider(p *domain.Provider) (ports.Provider, bool) {
	return httpprov.New(p.Type, p.APIKey, p.BaseURL, p.Model), true
}
