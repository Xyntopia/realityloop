import { supermarketObstacles, referenceFootprint } from './geometry.ts'

export type VideoSettings = Readonly<{
  fps: number
  width: number
  height: number
}>
type Numeric = Record<string, number>
export type VideoTrack = Readonly<{
  mode: 'spatial' | 'timeseries'
  name: string
  passed: boolean
  fields: readonly string[]
  times: readonly number[]
  samples: readonly Numeric[]
  durationSeconds: number
  obstacleScene: boolean
  bounds: Readonly<{minX:number;maxX:number;minZ:number;maxZ:number}>
}>
const palette = {
  background:[9,19,27],
  map:[15,32,42],
  border:[43,69,83],
  grid:[27,53,66],
  text:[218,240,240],
  faint:[111,157,164],
  mint:[75,221,192],
  sky:[99,171,247],
  orange:[252,174,104],
  danger:[247,119,123],
  shelf:[53,86,101],
  blocker:[179,73,82],
} as const

const validateFinite=(value:unknown,label:string):number=>{
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid video '+label)
  return value
}
const numeric=(value:unknown):Numeric=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return {}
  return Object.fromEntries(Object.entries(value).filter(
    (entry):entry is [string,number]=>typeof entry[1]==='number'&&Number.isFinite(entry[1])
  ))
}
const measured=(value:unknown,name:string):string=>{
  if(!value || typeof value!=='object')return name
  return typeof (value as {name?:unknown}).name==='string'
    ? (value as {name:string}).name:name
}

export const prepareVideoTrack=(result:unknown):VideoTrack=>{
  if(!result||typeof result!=='object'||Array.isArray(result)){
    throw Error('Video requires a stored simulation result object')
  }
  const source=result as Record<string,unknown>
  if(!Array.isArray(source.observations)||source.observations.length<2){
    throw Error('Video requires at least two stored trajectory observations')
  }
  const observations=source.observations as unknown[]
  if(observations.length>40_000)throw Error('Video source exceeds observation limit')
  const samples=observations.map((raw,i)=>{
    if(!raw||typeof raw!=='object')throw Error('Invalid video observation '+i)
    const item=raw as Record<string,unknown>
    const channels=numeric(item.channels)
    return {...channels,...numeric(item)}
  })
  const times=samples.map((sample,i)=>validateFinite(sample.timeSeconds,'time '+i))
  const first=times[0]!
  if(first<0||times.some((t,i)=>i>0&&t<=times[i-1]!)){
    throw Error('Video observations must have strictly increasing nonnegative timestamps')
  }
  const duration=times.at(-1)!-first
  if(duration<=0||duration>120)throw Error('Video duration must be in (0,120] seconds')
  const spatial=samples.every(item=>[item.x,item.z,item.yaw].every(Number.isFinite))
  const fields=Object.keys(samples[0]!).filter(key=>
    key!=='timeSeconds'&&key!=='step'&&samples.every(sample=>Number.isFinite(sample[key])))
  const chartFields=['slipSpeed','driveWheelSlip','v','speed','omega','traction','contactLoad','x','z',
    ...fields].filter((name,index,array)=>
      array.indexOf(name)===index&&fields.includes(name)).slice(0,3)
  if(!spatial&&!chartFields.length){
    throw Error('Video needs spatial samples or numeric Modelica channels')
  }
  const modelName=source.engine&&typeof source.engine==='object'
    ? measured(source.engine,''):''
  const title=measured(source.scenario,'RealityLoop experiment')
  const obstacleScene=spatial&&/supermarket|tennant|cleaning/i.test(title+' '+modelName)
  const xs=samples.map(s=>s.x??0)
  const zs=samples.map(s=>s.z??0)
  const extrema=(values:readonly number[])=>[Math.min(...values),Math.max(...values)] as const
  const [minX,maxX]=extrema(xs),[minZ,maxZ]=extrema(zs)
  const margin=1.2
  return {
    mode:spatial?'spatial':'timeseries',
    name:title,
    passed:!!(source.result&&typeof source.result==='object'&&
      (source.result as {passed?:unknown}).passed),
    fields:chartFields,
    times,samples,durationSeconds:duration,obstacleScene,
    bounds:obstacleScene
      ?{minX:-1,maxX:9,minZ:-4.7,maxZ:4.7}
      :{minX:minX-margin,maxX:maxX+margin,minZ:minZ-margin,maxZ:maxZ+margin},
  }
}
export const validateVideoSettings=(settings:VideoSettings,track:VideoTrack):number=>{
  const {width,height,fps}=settings
  if(!Number.isInteger(width)||!Number.isInteger(height)||
     width<480||width>1920||height<270||height>1080||
     width%2!==0||height%2!==0)throw Error('Video dimensions must be even, 480–1920 × 270–1080')
  if(!Number.isInteger(fps)||fps<1||fps>30)throw Error('Video FPS must be an integer between 1 and 30')
  const frames=Math.ceil(track.durationSeconds*fps)+1
  if(frames>2400)throw Error('Video exceeds 2400-frame safety limit')
  return frames
}

/** Small dependency-free RGB rasterizer: no DOM, GPU, canvas or browser. */
class Raster {
  readonly bytes:Buffer
  readonly scale:number
  readonly offsetX:number
  readonly offsetY:number
  readonly width:number
  readonly height:number
  constructor(width:number,height:number){
    this.width=width
    this.height=height
    this.bytes=Buffer.allocUnsafe(width*height*3)
    this.scale=Math.min(width/960,height/540)
    this.offsetX=(width-960*this.scale)/2
    this.offsetY=(height-540*this.scale)/2
    this.fill(0,0,960,540,palette.background)
  }
  private pos(x:number,y:number):[number,number]{
    return [Math.round(this.offsetX+x*this.scale),Math.round(this.offsetY+y*this.scale)]
  }
  fill(x:number,y:number,w:number,h:number,color:readonly number[]){
    const [left,top]=this.pos(x,y)
    const [right,bottom]=this.pos(x+w,y+h)
    const minX=Math.max(0,left),maxX=Math.min(this.width,right)
    const minY=Math.max(0,top),maxY=Math.min(this.height,bottom)
    for(let yy=minY;yy<maxY;yy++){
      const row=yy*this.width*3
      for(let xx=minX;xx<maxX;xx++){
        const offset=row+xx*3
        this.bytes[offset]=color[0]!
        this.bytes[offset+1]=color[1]!
        this.bytes[offset+2]=color[2]!
      }
    }
  }
  dot(x:number,y:number,r:number,color:readonly number[]){
    const [cx,cy]=this.pos(x,y)
    const radius=Math.max(1,Math.round(r*this.scale))
    for(let dy=-radius;dy<=radius;dy++)
      for(let dx=-radius;dx<=radius;dx++)
        if(dx*dx+dy*dy<=radius*radius){
          const xx=cx+dx,yy=cy+dy
          if(xx<0||yy<0||xx>=this.width||yy>=this.height)continue
          const o=(yy*this.width+xx)*3
          this.bytes[o]=color[0]!
          this.bytes[o+1]=color[1]!
          this.bytes[o+2]=color[2]!
        }
  }
  line(x0:number,y0:number,x1:number,y1:number,color:readonly number[],radius=1){
    const dx=x1-x0,dy=y1-y0
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)*this.scale*1.8))
    for(let i=0;i<=steps;i++){
      const t=i/steps
      this.dot(x0+dx*t,y0+dy*t,radius,color)
    }
  }
  label(text:string,x:number,y:number,color:readonly number[]=palette.text,scale=2){
    let xx=x
    for(const ch of text.toUpperCase()){
      const rows=FONT[ch]??FONT['?']!
      for(let row=0;row<7;row++){
        const bits=rows[row]??'00000'
        for(let col=0;col<5;col++)if(bits[col]==='1'){
          this.fill(xx+col*scale,y+row*scale,scale,scale,color)
        }
      }
      xx+=6*scale
      if(xx>952)break
    }
  }
}

const FONT:Record<string,readonly string[]>={
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  '?':['01110','10001','00001','00110','00100','00000','00100'],
  ':':['00000','00100','00100','00000','00100','00100','00000'],
  '.':['00000','00000','00000','00000','00000','01100','01100'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],
  '/':['00001','00001','00010','00100','01000','10000','10000'],
  '+':['00000','00100','00100','11111','00100','00100','00000'],
  '=':['00000','11111','00000','11111','00000','00000','00000'],
  '(':['00010','00100','01000','01000','01000','00100','00010'],
  ')':['01000','00100','00010','00010','00010','00100','01000'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['00111','01000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00010','11100'],
  'A':['01110','10001','10001','11111','10001','10001','10001'],
  'B':['11110','10001','10001','11110','10001','10001','11110'],
  'C':['01111','10000','10000','10000','10000','10000','01111'],
  'D':['11110','10001','10001','10001','10001','10001','11110'],
  'E':['11111','10000','10000','11110','10000','10000','11111'],
  'F':['11111','10000','10000','11110','10000','10000','10000'],
  'G':['01111','10000','10000','10111','10001','10001','01111'],
  'H':['10001','10001','10001','11111','10001','10001','10001'],
  'I':['11111','00100','00100','00100','00100','00100','11111'],
  'J':['00111','00010','00010','00010','10010','10010','01100'],
  'K':['10001','10010','10100','11000','10100','10010','10001'],
  'L':['10000','10000','10000','10000','10000','10000','11111'],
  'M':['10001','11011','10101','10101','10001','10001','10001'],
  'N':['10001','11001','10101','10011','10001','10001','10001'],
  'O':['01110','10001','10001','10001','10001','10001','01110'],
  'P':['11110','10001','10001','11110','10000','10000','10000'],
  'Q':['01110','10001','10001','10001','10101','10010','01101'],
  'R':['11110','10001','10001','11110','10100','10010','10001'],
  'S':['01111','10000','10000','01110','00001','00001','11110'],
  'T':['11111','00100','00100','00100','00100','00100','00100'],
  'U':['10001','10001','10001','10001','10001','10001','01110'],
  'V':['10001','10001','10001','10001','10001','01010','00100'],
  'W':['10001','10001','10001','10101','10101','11011','10001'],
  'X':['10001','10001','01010','00100','01010','10001','10001'],
  'Y':['10001','10001','01010','00100','00100','00100','00100'],
  'Z':['11111','00001','00010','00100','01000','10000','11111'],
}

const interpolate=(track:VideoTrack,time:number):Numeric=>{
  let hi=1
  while(hi<track.times.length-1 && track.times[hi]!<time)hi++
  const a=track.samples[hi-1]!,b=track.samples[hi]!
  const ta=track.times[hi-1]!,tb=track.times[hi]!
  const blend=Math.max(0,Math.min(1,(time-ta)/(tb-ta)))
  return Object.fromEntries(Object.keys(a).map(key=>[
    key,Number.isFinite(b[key])?a[key]!*(1-blend)+b[key]!*blend:a[key],
  ]))
}
const fmt=(n:number,places=2)=>Number.isFinite(n)?n.toFixed(places):'--'

const spatialFrame=(r:Raster,track:VideoTrack,sample:Numeric,time:number)=>{
  const scene={x:35,y:100,w:630,h:365}
  const {minX,maxX,minZ,maxZ}=track.bounds
  const point=(x:number,z:number):[number,number]=>[
    scene.x+26+(x-minX)/(maxX-minX)*(scene.w-52),
    scene.y+24+(z-minZ)/(maxZ-minZ)*(scene.h-48),
  ]
  for(let i=0;i<11;i++){
    const x=scene.x+26+i*(scene.w-52)/10
    r.line(x,scene.y+16,x,scene.y+scene.h-18,palette.grid,0.7)
  }
  for(let i=0;i<9;i++){
    const y=scene.y+20+i*(scene.h-40)/8
    r.line(scene.x+18,y,scene.x+scene.w-18,y,palette.grid,0.7)
  }
  if(track.obstacleScene){
    for(const obs of supermarketObstacles){
      const a=point(obs.x-obs.halfX,obs.z-obs.halfZ)
      const b=point(obs.x+obs.halfX,obs.z+obs.halfZ)
      r.fill(a[0],a[1],b[0]-a[0],b[1]-a[1],
        obs.kind==='shelf'?palette.shelf:palette.blocker)
      r.label(obs.kind==='shelf'?'SHELF':'BLOCKER',a[0]+4,a[1]+8,palette.text,1)
    }
  }
  let prev:Numeric|undefined
  for(const observation of track.samples){
    if(observation.timeSeconds!>time)break
    if(prev){
      const a=point(prev.x!,prev.z!),b=point(observation.x!,observation.z!)
      r.line(a[0],a[1],b[0],b[1],palette.mint,1.7)
    }
    prev=observation
  }
  const [gx,gy]=point(7.5,0)
  if(track.obstacleScene){
    r.dot(gx,gy,5,palette.orange)
    r.dot(gx,gy,2,palette.map)
  }
  const [rx,ry]=point(sample.x!,sample.z!)
  const sizeX=referenceFootprint.halfLengthMetres*(scene.w-52)/(maxX-minX)
  const sizeZ=referenceFootprint.halfWidthMetres*(scene.h-48)/(maxZ-minZ)
  const corners=[[-sizeX,-sizeZ],[sizeX,-sizeZ],[sizeX,sizeZ],[-sizeX,sizeZ]]
    .map(([x,z]):[number,number]=>[
      rx+x!*Math.cos(sample.yaw!)-z!*Math.sin(sample.yaw!),
      ry+x!*Math.sin(sample.yaw!)+z!*Math.cos(sample.yaw!),
    ])
  corners.forEach((corner,i)=>{
    const next=corners[(i+1)%corners.length]!
    r.line(corner[0],corner[1],next[0],next[1],palette.sky,2)
  })
  r.dot(rx,ry,3,palette.text)
  r.line(rx,ry,rx+Math.cos(sample.yaw!)*sizeX*1.4,
    ry+Math.sin(sample.yaw!)*sizeX*1.4,palette.orange,2.5)
  r.label('X '+fmt(sample.x!),702,166,palette.text,2)
  r.label('Z '+fmt(sample.z!),702,207,palette.text,2)
  r.label('YAW '+fmt(sample.yaw!),702,248,palette.text,2)
  r.label('SPEED '+fmt(sample.speed??sample.v??0),702,289,palette.mint,2)
  r.label('CLEANED '+fmt(sample.cleanedAreaSqMetres??0,1)+' M2',702,330,palette.faint,1)
}

const seriesFrame=(r:Raster,track:VideoTrack,time:number)=>{
  const x0=65,y0=130,w=580,h=300
  const start=track.times[0]!
  const colors=[palette.mint,palette.sky,palette.orange]
  for(let row=0;row<=6;row++){
    const y=y0+row*h/6
    r.line(x0,y,x0+w,y,palette.grid,1)
  }
  for(let idx=0;idx<track.fields.length;idx++){
    const name=track.fields[idx]!
    const values=track.samples.map(s=>s[name]!)
    let min=Math.min(...values),max=Math.max(...values)
    if(max-min<1e-9){min-=1;max+=1}
    const color=colors[idx%colors.length]!
    let prev:[number,number]|undefined
    for(let i=0;i<track.samples.length;i++){
      const t=track.times[i]!
      if(t>time)break
      const pos:[number,number]=[
        x0+(t-start)/track.durationSeconds*w,
        y0+(1-(values[i]!-min)/(max-min))*h,
      ]
      if(prev)r.line(prev[0],prev[1],pos[0],pos[1],color,1.4)
      prev=pos
    }
    r.dot(702,164+idx*66,5,color)
    r.label(name.slice(0,19),717,153+idx*66,palette.text,1)
    const current=interpolate(track,time)
    r.label(fmt(current[name]!),717,169+idx*66,color,2)
    r.label('RANGE '+fmt(min,1)+' '+fmt(max,1),702,199+idx*66,palette.faint,1)
  }
  const cursor=x0+(time-start)/track.durationSeconds*w
  r.line(cursor,y0,cursor,y0+h,palette.text,0.5)
}

export const renderVideoFrame=(
  track:VideoTrack,settings:VideoSettings,frameIndex:number,
):Buffer=>{
  const count=validateVideoSettings(settings,track)
  if(!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=count){
    throw Error('Invalid video frame index')
  }
  const time=Math.min(track.times[0]!+frameIndex/settings.fps,track.times.at(-1)!)
  const current=interpolate(track,time)
  const r=new Raster(settings.width,settings.height)
  r.fill(20,19,920,60,palette.map)
  r.fill(20,19,6,60,palette.mint)
  r.label('REALITYLOOP',42,33,palette.mint,3)
  r.label(track.mode==='spatial'?'SIMULATION REPLAY':'MODELICA EXPERIMENT',345,43,palette.faint,1)
  r.label(track.name.slice(0,40),35,85,palette.text,1)
  r.fill(25,100,645,365,palette.map)
  r.fill(682,100,250,365,palette.map)
  r.label('TELEMETRY',704,116,palette.faint,2)
  if(track.mode==='spatial')spatialFrame(r,track,current,time)
  else seriesFrame(r,track,time)
  r.fill(20,480,920,43,palette.map)
  r.fill(20,480,920*(time-track.times[0]!)/track.durationSeconds,4,palette.mint)
  r.label('TIME '+fmt(time-track.times[0]!,2)+' / '+fmt(track.durationSeconds,2)+' S',
    39,495,palette.text,2)
  r.label(track.passed?'RESULT PASS':'RESULT FAIL',755,496,
    track.passed?palette.mint:palette.danger,1)
  return r.bytes
}
