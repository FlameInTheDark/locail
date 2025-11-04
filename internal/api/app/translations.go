package app

import (
    "context"
    "locail/internal/domain"
    "locail/internal/ports"
)

type TranslationsAPI struct { repo ports.TranslationRepository; units ports.UnitRepository }

func NewTranslationsAPI(repo ports.TranslationRepository) *TranslationsAPI { return &TranslationsAPI{repo: repo} }

func NewTranslationsAPIWithUnits(repo ports.TranslationRepository, units ports.UnitRepository) *TranslationsAPI {
    return &TranslationsAPI{repo: repo, units: units}
}

type UpsertTranslationRequest struct {
    UnitID  int64  `json:"unit_id"`
    Locale  string `json:"locale"`
    Text    string `json:"text"`
    Status  string `json:"status"`
    ProviderID *int64 `json:"provider_id"`
}

func (a *TranslationsAPI) Upsert(req UpsertTranslationRequest) (bool, error) {
    ctx := context.Background()
    t := &domain.Translation{UnitID: req.UnitID, Locale: req.Locale, Text: req.Text, Status: req.Status, ProviderID: req.ProviderID}
    return true, a.repo.Upsert(ctx, t)
}

type FileLocaleTranslationsRequest struct {
    FileID int64 `json:"file_id"`
    Locale string `json:"locale"`
}

type UnitText struct { UnitID int64 `json:"unit_id"`; Key string `json:"key"`; Source string `json:"source"`; Translation string `json:"translation"`; Status string `json:"status"` }

func (a *TranslationsAPI) ListUnitTexts(fileID int64, locale string) ([]*UnitText, error) {
    ctx := context.Background()
    units, err := a.units.ListByFile(ctx, fileID)
    if err != nil { return nil, err }
    trs, err := a.repo.ListByFileLocale(ctx, fileID, locale)
    if err != nil { return nil, err }
    byUnit := map[int64]*domain.Translation{}
    for _, t := range trs { byUnit[t.UnitID] = t }
    out := make([]*UnitText, 0, len(units))
    for _, u := range units {
        t := byUnit[u.ID]
        text := ""; status := ""
        if t != nil { text = t.Text; status = t.Status }
        out = append(out, &UnitText{UnitID: u.ID, Key: u.Key, Source: u.SourceText, Translation: text, Status: status})
    }
    return out, nil
}
