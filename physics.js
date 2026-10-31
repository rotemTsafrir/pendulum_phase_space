/* Pendulum dynamics: theta from downward vertical; omega in rad/s.
   No p5 dependency: this module can also be tested with Node. */
(function(root) {
  'use strict';
  const TAU = 2 * Math.PI;
  const wrap = theta => ((theta + Math.PI) % TAU + TAU) % TAU - Math.PI;
  function acceleration(theta, omega, t, p) {
    return -p.gravity / p.length * Math.sin(theta) - p.damping * omega;
  }
  function rk4(theta, omega, t, h, p) {
    const a1 = acceleration(theta, omega, t, p);
    const v2 = omega + h * a1 / 2;
    const a2 = acceleration(theta + h * omega / 2, v2, t + h / 2, p);
    const v3 = omega + h * a2 / 2;
    const a3 = acceleration(theta + h * v2 / 2, v3, t + h / 2, p);
    const v4 = omega + h * a3;
    const a4 = acceleration(theta + h * v3, v4, t + h, p);
    return [theta + h / 6 * (omega + 2 * v2 + 2 * v3 + v4), omega + h / 6 * (a1 + 2 * a2 + 2 * a3 + a4)];
  }
  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function sampleInitial(p) {
    const random = seededRandom(p.seed);
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-15))) * Math.cos(TAU * random());
    const draw = () => p.distribution === 'uniform' ? Math.sqrt(3) * (2 * random() - 1) : normal();
    return Array.from({length:p.count}, () => [wrap(p.meanAngle + p.stdAngle * draw()), p.meanOmega + p.stdOmega * draw()]);
  }
  function speed(theta, omega, t, p) {
    const T = Math.sqrt(p.length / p.gravity);
    return Math.hypot(T * omega, T * T * acceleration(theta, omega, t, p));
  }
  // A time-independent upper bound over the displayed velocity range.
  function speedBound(p, omegaMax) {
    const T = Math.sqrt(p.length / p.gravity);
    return Math.hypot(T * omegaMax, T*T * (p.gravity/p.length + p.damping * omegaMax));
  }
  function sampleMean(states) {
    let x=0,y=0,omega=0;
    for(const [a,w] of states){x+=Math.cos(a);y+=Math.sin(a);omega+=w;}
    const concentration=Math.hypot(x,y)/states.length;
    return {theta:concentration<1e-8?null:Math.atan2(y,x),omega:omega/states.length,concentration};
  }
  function energies(theta,omega,p){
    const kinetic=0.5*p.length*p.length*omega*omega;
    const potential=p.gravity*p.length*(1-Math.cos(theta));
    return {kinetic,potential,total:kinetic+potential};
  }
  class Ring {
    constructor(capacity) { this.capacity=capacity; this.data=new Array(capacity); this.size=0; this.head=0; }
    push(value) { this.data[this.head]=value; this.head=(this.head+1)%this.capacity; this.size=Math.min(this.size+1,this.capacity); }
    get(i) { return this.data[(this.head-this.size+i+this.capacity)%this.capacity]; }
    clear() { this.size=0; this.head=0; }
  }
  const api={sampleMean,energies,TAU,wrap,acceleration,rk4,seededRandom,sampleInitial,speed,speedBound,Ring};
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.PendulumPhysics=api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
