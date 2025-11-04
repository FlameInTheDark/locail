package csv

import (
    "bytes"
    "encoding/csv"
    "strings"
    "locail/internal/ports"
)

type Exporter struct{}

func New() *Exporter { return &Exporter{} }

func (e *Exporter) Format() string { return "csv" }

func (e *Exporter) Export(language string, items []ports.ExportItem) ([]byte, error) {
    var buf bytes.Buffer
    w := csv.NewWriter(&buf)
    // Allow separator selection via language hint: "sep:comma|semicolon|tab"
    if strings.HasPrefix(strings.ToLower(language), "sep:") {
        typ := strings.TrimSpace(strings.ToLower(strings.TrimPrefix(language, "sep:")))
        switch typ {
        case "semicolon":
            w.Comma = ';'
        case "tab":
            w.Comma = '\t'
        default:
            w.Comma = ','
        }
    }
    _ = w.Write([]string{"key", "source", "translation"})
    for _, it := range items {
        v := it.Translation
        if v == "" { v = it.SourceText }
        _ = w.Write([]string{it.Key, it.SourceText, v})
    }
    w.Flush()
    return buf.Bytes(), nil
}
