package domain

import "time"

type Template struct {
	ID        int64     `json:"id"`
	Scope     string    `json:"scope"`  // global | project | provider
	RefID     *int64    `json:"ref_id"` // project_id or provider_id
	Type      string    `json:"type"`   // translate_single | translate_file | detect_language
	Role      string    `json:"role"`   // system | user
	Body      string    `json:"body"`
	IsDefault bool      `json:"is_default"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Setting struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type CacheEntry struct {
	ID          int64     `json:"id"`
	SourceText  string    `json:"source_text"`
	SrcLang     string    `json:"src_lang"`
	TgtLang     string    `json:"tgt_lang"`
	Provider    string    `json:"provider"`
	Model       string    `json:"model"`
	Translation string    `json:"translation"`
	CreatedAt   time.Time `json:"created_at"`
}
