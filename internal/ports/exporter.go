package ports

type ExportItem struct {
	Key         string
	SourceText  string
	Translation string
}

type Exporter interface {
	Format() string
	Export(language string, items []ExportItem) ([]byte, error)
}
