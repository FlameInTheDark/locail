package csv

import (
    "bytes"
    "encoding/csv"
    "locail/internal/ports"
)

type Exporter struct{}

func New() *Exporter { return &Exporter{} }

func (e *Exporter) Format() string { return "csv" }

func (e *Exporter) Export(language string, items []ports.ExportItem) ([]byte, error) {
    var buf bytes.Buffer
    w := csv.NewWriter(&buf)
    _ = w.Write([]string{"key", "source", "translation"})
    for _, it := range items {
        v := it.Translation
        if v == "" { v = it.SourceText }
        _ = w.Write([]string{it.Key, it.SourceText, v})
    }
    w.Flush()
    return buf.Bytes(), nil
}

