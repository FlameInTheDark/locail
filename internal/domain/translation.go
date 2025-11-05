package domain

import "time"

type Translation struct {
	ID         int64     `json:"id"`
	UnitID     int64     `json:"unit_id"`
	Locale     string    `json:"locale"`
	Text       string    `json:"text"`
	Status     string    `json:"status"`
	ProviderID *int64    `json:"provider_id"`
	Confidence *float64  `json:"confidence"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
