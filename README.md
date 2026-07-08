# Ekzen Servis Takip V3.6.3 - Tahsilat Yapan Hakediş Fix

Bu sürüm V3.6.2 üzerine düzeltmedir.

## Düzeltme
- "Tahsilat Yapan: Servis Kaynağı Aldı" seçildiğinde Hakediş sayacı artık düşmez.
- Hakediş sayacı, tahsilatı kimin aldığından bağımsız olarak toplam hakedişi gösterir.
- Tahsilat yapan seçimi sadece Kalan Ödeme hesabını etkiler.

## Mantık
- Ben Aldım: Kalan Ödeme artar.
- Servis Kaynağı Aldı: Kalan Ödeme düşer.
- Kalan Ödeme eksiye düşerse servis kaynağı sana borçlu demektir.
