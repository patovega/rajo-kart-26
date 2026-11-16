import cv2, numpy as np, json, math, heapq
mask = cv2.imread('mask59.png', 0) > 0
H, W = mask.shape
WP = [(190,1450),(215,1200),(150,900),(160,780),(250,644),(350,537),(550,367),(850,183),(1145,125),(1000,206),(850,289),(700,380),(550,536),(450,653),(350,772),(300,856),(300,964),(345,1020),(450,774),(550,680),(700,591),(850,503),(1000,451),(1250,440),(1290,485),(1000,547),(850,628),(700,789),(550,934),(500,1080),(700,882),(850,724),(1000,676),(1200,700),(1500,800),(1560,850),(1300,830),(1000,865),(850,930),(700,1156),(640,1385),(850,1133),(950,1020),(850,1260),(800,1460),(870,1330),(1000,1220)]
def snap(p):
    x, y = p; best = None
    for r in range(0, 90):
        ys, xs = np.nonzero(mask[max(0,y-r):y+r+1, max(0,x-r):x+r+1])
        if len(ys): 
            d = (ys + max(0,y-r) - y) ** 2 + (xs + max(0,x-r) - x) ** 2; k = d.argmin(); return (int(xs[k] + max(0,x-r)), int(ys[k] + max(0,y-r)))
    raise SystemExit('sin máscara cerca de %s' % (p,))
def path(a, b):
    dist = {a: 0}; prev = {}; pq = [(0, a)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == b: break
        if d > dist.get(u, 1e18): continue
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if not dx and not dy: continue
                v = (u[0] + dx, u[1] + dy)
                if v[0] < 0 or v[1] < 0 or v[0] >= W or v[1] >= H or not mask[v[1], v[0]]: continue
                nd = d + math.hypot(dx, dy)
                if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    if b not in prev and a != b: raise SystemExit('sin camino %s -> %s' % (a, b))
    out = [b]
    while out[-1] != a: out.append(prev[out[-1]])
    return out[::-1]
pts = []
S = [snap(p) for p in WP]
for a, b in zip(S, S[1:]):
    seg = path(a, b); pts += seg[:-1]
pts.append(S[-1]); print('trazo', len(pts), 'px')
# índice del empalme J (waypoint 8) en el trazo
J = pts.index(S[8]) if S[8] in pts else min(range(len(pts)), key=lambda k: math.hypot(pts[k][0]-S[8][0], pts[k][1]-S[8][1]))
V = min(range(len(pts)), key=lambda k: math.hypot(pts[k][0]-S[17][0], pts[k][1]-S[17][1]))
json.dump({'pts': pts, 'J': J, 'V': V, 'wp': S}, open('trace59.json', 'w')); print('J', J, pts[J])
im = cv2.imread('../images/59.png')
for k, p in enumerate(pts):
    if k % 3 == 0: im[p[1], p[0]] = (0, 0, 255)
for k, p in enumerate(S): cv2.circle(im, p, 6, (0, 255, 0), 2); cv2.putText(im, str(k), p, 0, 0.6, (0, 255, 0), 2)
cv2.imwrite('trace59.png', cv2.resize(im, None, fx=0.6, fy=0.6))
