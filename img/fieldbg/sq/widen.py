# 정사각 필드·룸 그림(sq/)을 배틀맵 비율 1500x640 으로 넓힌다: 가운데는 원본 선명하게, 양옆은 무늬면 좌우 반전 이어 붙이기, 그림이면 크게 흐린 배경. 실행: python3 widen.py sq/ ./
from PIL import Image, ImageFilter, ImageOps, ImageEnhance
import os,sys
src,out=sys.argv[1],sys.argv[2]
W,H=1500,640
TEX={'field_object_grass','field_object_psycho','field_object_mist'}
for f in sorted(os.listdir(src)):
    im=Image.open(src+f).convert('RGB')
    if im.size[0]!=im.size[1]:continue
    name=f.rsplit('.',1)[0]
    s=im.resize((H,H),Image.LANCZOS)
    if name in TEX:
        m=ImageOps.mirror(s);strip=Image.new('RGB',(W+4*H,H));x=W//2-H//2-H*3;i=0
        while x<W+H:
            strip.paste(s if i%2==0 else m,(x+2*H,0));x+=H;i+=1
        bg=strip.crop((2*H,0,2*H+W,H)).filter(ImageFilter.GaussianBlur(4));bg=ImageEnhance.Brightness(bg).enhance(0.85)
    else:
        z=im.resize((W,W),Image.LANCZOS).crop((0,(W-H)//2,W,(W-H)//2+H))
        bg=z.filter(ImageFilter.GaussianBlur(30));bg=ImageEnhance.Brightness(bg).enhance(0.62)
    c=s.filter(ImageFilter.UnsharpMask(radius=2,percent=70,threshold=2))
    mask=Image.linear_gradient('L').rotate(90,expand=True).resize((H,H))  # placeholder
    mask=Image.new('L',(H,H));fe=120
    row=[int(255*min(1,xx/fe,(H-xx)/fe)) for xx in range(H)]
    mask.putdata(row*H)
    bg.paste(c,(W//2-H//2,0),mask)
    bg.save(out+f,'WEBP',quality=86,method=6)
