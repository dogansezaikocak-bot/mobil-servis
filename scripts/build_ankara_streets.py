#!/usr/bin/env python3
"""Create small static Ankara cadde/sokak catalogs from October 2026 NVİ-referenced data.
Generated JSON per district is served by GitHub Pages, no client OSM calls.
"""
import collections
import json
import pathlib
import re
import unicodedata
import urllib.request

ROOT = "https://raw.githubusercontent.com/onurusluca/turkey-geo-api/main/data/jsonl/province-6/"
OUT = pathlib.Path("data/ankara-streets")
TYPES = {0:"Köy Sokağı",1:"Meydan",2:"Bulvar",3:"Cadde",4:"Sokak",5:"Küme Evler"}

def slug(value):
    v = str(value or "").casefold().translate(str.maketrans({"ı":"i","ğ":"g","ü":"u","ş":"s","ö":"o","ç":"c"}))
    return re.sub(r"[^a-z0-9]+","-",unicodedata.normalize("NFKD",v)).strip("-")

def records(name):
    url=ROOT+name
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"EKZEN-address-catalog/1.0"}),timeout=120) as response:
        for raw in response:
            if raw.strip():
                yield json.loads(raw)

districts={int(r["id"]):str(r["name"]) for r in records("districts.jsonl")}
neighborhoods={int(r["id"]):(int(r["district_id"]),slug(r["name"])) for r in records("neighborhoods.jsonl") if r.get("name")}
by_district=collections.defaultdict(lambda:collections.defaultdict(set))
count=0
for s in records("streets.jsonl"):
    info=neighborhoods.get(int(s.get("neighborhood_id") or 0))
    if not info:continue
    did,nslug=info
    if did not in districts:continue
    title=str(s.get("full_official_name") or "").strip()
    if not title:
        base=str(s.get("name") or "").strip()
        typ=s.get("type_name") or TYPES.get(s.get("type_code"),"")
        title=(base+" "+typ).strip()
    if not title:continue
    by_district[did][nslug].add(title)
    count+=1

if count<15000:
    raise RuntimeError(f"Unexpectedly low Ankara street count ({count}); refusing to publish incomplete catalog")
OUT.mkdir(parents=True,exist_ok=True)
total=0
for did,dname in districts.items():
    data={key:sorted(names,key=lambda x:x.casefold()) for key,names in by_district[did].items()}
    total+=sum(len(v) for v in data.values())
    (OUT/(slug(dname)+".json")).write_text(json.dumps({"source":"NVİ-referenced October 2026","district":dname,"neighborhoods":data},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print(f"Published {total} unique Ankara district/neighborhood street records in {len(districts)} district files")
