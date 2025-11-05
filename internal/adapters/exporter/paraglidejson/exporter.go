package paraglidejson

import (
	"encoding/json"
	"locail/internal/ports"
)

type Exporter struct{}

func New() *Exporter { return &Exporter{} }

func (e *Exporter) Format() string { return "paraglidejson" }

func (e *Exporter) Export(language string, items []ports.ExportItem) ([]byte, error) {
	out := make(map[string]string, len(items))
	for _, it := range items {
		v := it.Translation
		if v == "" {
			v = it.SourceText
		}
		out[it.Key] = v
	}
	return json.MarshalIndent(out, "", "  ")
}
