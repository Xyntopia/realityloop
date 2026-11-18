/** Deterministic, longitude-periodic synthetic cloud field. Neither NASA
 * weather data nor a forecast. The seam wraps exactly at +/-180 degrees. */
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x))
const fract=(x:number)=>x-Math.floor(x)
const hash=(x:number,y:number,seed:number)=>
  fract(Math.sin((x+seed*19.13)*127.1+(y+seed*7.91)*311.7)*43758.5453123)
const valueNoise=(u:number,v:number,nx:number,ny:number,seed:number)=>{
  const x=u*nx,y=v*ny
  const ix=Math.floor(x),iy=Math.floor(y)
  const fx=x-ix,fy=y-iy
  const ax=fx*fx*(3-2*fx),ay=fy*fy*(3-2*fy)
  const h=(dx:number,dy:number)=>hash(((ix+dx)%nx+nx)%nx,
    Math.max(0,Math.min(ny,iy+dy)),seed)
  return (h(0,0)*(1-ax)+h(1,0)*ax)*(1-ay)
    +(h(0,1)*(1-ax)+h(1,1)*ax)*ay
}

export const earthCloudAlpha=(longitude:number,latitude:number,layer=0)=>{
  const u=fract(longitude)
  const v=clamp(latitude,0,1)
  // Circulation belts curve with longitude, but remain exactly periodic.
  const front=.08*Math.sin(2*Math.PI*(u*3+.09*Math.sin(v*6*Math.PI)))
    +.037*Math.sin(2*Math.PI*(u*8-v*1.9))
  const latitudeBelts=.035*Math.cos((v-.5)*8*Math.PI)
  const coarse=valueNoise(u,v,12,6,layer*7+1)
  const mid=valueNoise(u,v,32,16,layer*7+2)
  const fine=valueNoise(u,v,86,48,layer*7+3)
  const fleck=valueNoise(u,v,172,96,layer*7+4)
  const density=.4*coarse+.29*mid+.22*fine+.09*fleck
    +front+latitudeBelts
  const threshold=layer===0 ? .49 : .57
  const cover=clamp((density-threshold)*3.0,0,.94)
  const polarFade=clamp(Math.min(v,1-v)*9.5,0,1)
  return Math.round(255*cover*(.55+.45*polarFade))
}
