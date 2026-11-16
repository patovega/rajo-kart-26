import json, cv2, re, math
h=open(r"c:/Users/Usuario/Documents/juegos/rajo-kart/index.html",encoding="utf8").read()
i=h.index("const SEC = ["); j=h.index("];      // caminos interiores",i)
S=json.loads(h[i+12:j+1].replace("\n","")); names=h[j:h.index("\n",j)].split(":")[1].strip().split(", ")
i=h.index("const ROUTE = ["); R=json.loads(h[i+14:h.index(";",i)])
F7=json.loads(re.search(r"const F7POLY = (\[.*?\]);",h).group(1)); FP=json.loads(re.search(r"const FPOLY = (\[.*?\]);",h).group(1))
im=cv2.imread(r"c:/Users/Usuario/Documents/juegos/rajo-kart/imagenes/rajo_aereo_planta.png")
sc=2400/2700; P=lambda x,z:(int((x+1350-30)*sc),int((z+1125-45)*sc))
cols=[(0,0,255),(255,0,0),(200,100,255),(200,150,255),(255,100,0),(0,200,0),(0,255,255),(255,255,0),(0,140,255),(128,0,128),(128,0,128),(0,0,128)]
for k,s in enumerate(S):
  pts=[P(p[0],p[1]) for p in s]
  for a,b in zip(pts,pts[1:]): cv2.line(im,a,b,cols[k%12],4)
  for t in list(range(0,len(pts),25))+[len(pts)-1]: cv2.putText(im,"%s%d %d"%(names[k][:4],t,s[t][2]),pts[t],0,0.8,cols[k%12],2)
pts=[P(p[0],p[1]) for p in R]
for a,b in zip(pts,pts[1:]): cv2.line(im,a,b,(0,0,0),4)
L=0
for t in range(0,len(R)-1):
  if t%40==0: cv2.putText(im,"R%d s=%d"%(t,L),pts[t],0,0.8,(0,0,0),2)
  L+=math.hypot(R[t+1][0]-R[t][0],R[t+1][1]-R[t][1])
for poly,c in ((F7,(255,255,255)),(FP,(255,255,255))):
  q=[P(a,b) for a,b in poly]
  for a,b in zip(q,q[1:]+q[:1]): cv2.line(im,a,b,c,3)
cv2.imwrite("mapa.png",cv2.resize(im,(1600,1333)))
