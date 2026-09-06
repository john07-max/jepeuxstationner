"""Controlled text-table extraction; no OCR. Requires pdfplumber==0.11.8.
Usage: python scripts/extract-lyon-annex.py input.pdf data/lyon/streets.json
The PDF reference, SHA256 and page numbers are retained; changed PDF requires review.
"""
import hashlib,json,re,sys
import pdfplumber
source='https://www.lyon.fr/sites/lyonfr/files/content/documents/2026-03/2026RP48956_Annexe_1_voies_reglementees_zone_tarifaire.pdf'
rows=[]
with pdfplumber.open(sys.argv[1]) as pdf:
    assert len(pdf.pages)==66, 'Unexpected document version: review required'
    for number,page in enumerate(pdf.pages[:62],1):
        count=0
        for table in page.extract_tables({'text_x_tolerance':0.5,'text_y_tolerance':2}):
            for row in table:
                cells=[' '.join((v or '').split()) for v in row]
                if not cells or not re.fullmatch(r'LYON [1-9]',cells[0]): continue
                assert len(cells)==4 and cells[1] and cells[2], (number,cells)
                arrondissement=int(cells[0][-1]);name=cells[1]
                rows.append({'externalId':f'{arrondissement}:{name}', 'arrondissement':arrondissement,'name':name,'regulation':cells[2],'extension':cells[3],'page':number})
                count+=1
        assert count>0, f'No valid rows on page {number}'
assert len({r['externalId'] for r in rows})==len(rows), 'Duplicate street identities: review required'
result={'version':'2026RP48956-annexe-1','sourceUrl':source,'sha256':hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest(),'pages':66,'interpretedPages':62,'quarantinedPages':[63,64,65,66],'streets':rows}
open(sys.argv[2],'w').write(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'rows':len(rows),'complete':sum(r['regulation'].lower()=='complet' for r in rows),'pages':66}))
