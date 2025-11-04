package valvevdf

import (
    "bytes"
    "fmt"
    "locail/internal/ports"
)

type Exporter struct{}

func New() *Exporter { return &Exporter{} }

func (e *Exporter) Format() string { return "valvevdf" }

func (e *Exporter) Export(language string, items []ports.ExportItem) ([]byte, error) {
    // Produce a simple VDF structure similar to HL2 format
    var b bytes.Buffer
    b.WriteString("\"lang\"\n{")
    b.WriteString("\n\t\"language\" \"")
    b.WriteString(language)
    b.WriteString("\"\n\t\"tokens\"\n\t{\n")
    for _, it := range items {
        v := it.Translation
        if v == "" { v = it.SourceText }
        // Escape quotes
        v = escapeVDF(v)
        k := escapeVDF(it.Key)
        fmt.Fprintf(&b, "\t\t\"%s\"\t\t\"%s\"\n", k, v)
    }
    b.WriteString("\t}\n}")
    return b.Bytes(), nil
}

func escapeVDF(s string) string {
    // replace backslash and quotes for VDF compliance
    b := []byte(s)
    b = bytes.ReplaceAll(b, []byte("\\"), []byte("\\\\"))
    b = bytes.ReplaceAll(b, []byte("\""), []byte("\\\""))
    return string(b)
}
