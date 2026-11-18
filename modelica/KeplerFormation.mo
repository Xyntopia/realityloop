// Two-spacecraft osculating Keplerian formation, Earth-centered inertial frame.
// Initial conditions are classical orbital elements, not an invented path.
// Two-body point-mass Earth; no J2, drag, third-body, SRP or maneuvers.
// All orbital elements are in SI radians/metres and remain constant.
model KeplerFormation
  parameter Real mu=3.986004418e14 "Earth standard gravitational parameter [m3/s2]";
  parameter Real semiMajorAxis=6878137 "Earth-center semi-major axis [m]";
  parameter Real eccentricity=.0011 "Chief eccentricity";
  parameter Real inclination=.901288 "Inclination [rad]";
  parameter Real raan=.35 "Right ascension of ascending node [rad]";
  parameter Real argumentOfPeriapsis=.42 "Argument of perigee [rad]";
  parameter Real meanAnomalyAtEpoch=.1 "Chief mean anomaly at start [rad]";
  parameter Real servicerEccentricityOffset=7.0e-7 "Differential eccentricity";
  parameter Real servicerMeanAnomalyOffset=1.2e-6 "Differential along-track phase [rad]";
  parameter Real meanMotion=sqrt(mu/(semiMajorAxis*semiMajorAxis*semiMajorAxis));
  Real meanAnomaly;
  Real servicerMeanAnomaly;
  Real eccentricAnomaly;
  Real servicerEccentricAnomaly;
  Real p;
  Real q;
  Real sp;
  Real sq;
  Real tx "Chief ECI x [m]";
  Real ty "Chief ECI y [m]";
  Real tz "Chief ECI z [m]";
  Real tvx "Chief ECI velocity x [m/s]";
  Real tvy "Chief ECI velocity y [m/s]";
  Real tvz "Chief ECI velocity z [m/s]";
  Real sx "Servicer ECI x [m]";
  Real sy "Servicer ECI y [m]";
  Real sz "Servicer ECI z [m]";
  Real svx "Servicer ECI velocity x [m/s]";
  Real svy "Servicer ECI velocity y [m/s]";
  Real svz "Servicer ECI velocity z [m/s]";
  Real chiefPerifocalVelocityP;
  Real chiefPerifocalVelocityQ;
  Real servicerPerifocalVelocityP;
  Real servicerPerifocalVelocityQ;
  Real targetRadius "Chief geocentric radius [m]";
  Real separation "Relative separation [m]";
  Real orbitalPeriod "Keplerian period [s]";
  Real u;
  Real v;
  Real w;
  Real uu;
  Real vv;
  Real ww;
equation
  meanAnomaly=meanAnomalyAtEpoch+meanMotion*time;
  servicerMeanAnomaly=meanAnomalyAtEpoch+servicerMeanAnomalyOffset+meanMotion*time;
  // Kepler equation solved as algebraic loops (unique for 0<=e<1).
  eccentricAnomaly=meanAnomaly+eccentricity*sin(eccentricAnomaly);
  servicerEccentricAnomaly=servicerMeanAnomaly
    +(eccentricity+servicerEccentricityOffset)*sin(servicerEccentricAnomaly);
  p=semiMajorAxis*(cos(eccentricAnomaly)-eccentricity);
  q=semiMajorAxis*sqrt(1-eccentricity*eccentricity)*sin(eccentricAnomaly);
  sp=semiMajorAxis*(cos(servicerEccentricAnomaly)
    -eccentricity-servicerEccentricityOffset);
  sq=semiMajorAxis*sqrt(1-(eccentricity+servicerEccentricityOffset)
    *(eccentricity+servicerEccentricityOffset))*sin(servicerEccentricAnomaly);
  // Standard perifocal -> geocentric equatorial inertial transform.
  u=cos(raan)*cos(argumentOfPeriapsis)
    -sin(raan)*sin(argumentOfPeriapsis)*cos(inclination);
  v=sin(raan)*cos(argumentOfPeriapsis)
    +cos(raan)*sin(argumentOfPeriapsis)*cos(inclination);
  w=sin(argumentOfPeriapsis)*sin(inclination);
  uu=-cos(raan)*sin(argumentOfPeriapsis)
    -sin(raan)*cos(argumentOfPeriapsis)*cos(inclination);
  vv=-sin(raan)*sin(argumentOfPeriapsis)
    +cos(raan)*cos(argumentOfPeriapsis)*cos(inclination);
  ww=cos(argumentOfPeriapsis)*sin(inclination);
  tx=u*p+uu*q;
  ty=v*p+vv*q;
  tz=w*p+ww*q;
  sx=u*sp+uu*sq;
  sy=v*sp+vv*sq;
  sz=w*sp+ww*sq;
  // Analytic Keplerian ECI velocities. Finite differencing consecutive
  // observations would introduce cadence-dependent RTN frame errors.
  chiefPerifocalVelocityP=-semiMajorAxis*meanMotion*sin(eccentricAnomaly)/
    (1-eccentricity*cos(eccentricAnomaly));
  chiefPerifocalVelocityQ=semiMajorAxis*meanMotion*
    sqrt(1-eccentricity*eccentricity)*cos(eccentricAnomaly)/
    (1-eccentricity*cos(eccentricAnomaly));
  servicerPerifocalVelocityP=-semiMajorAxis*meanMotion*sin(servicerEccentricAnomaly)/
    (1-(eccentricity+servicerEccentricityOffset)*cos(servicerEccentricAnomaly));
  servicerPerifocalVelocityQ=semiMajorAxis*meanMotion*
    sqrt(1-(eccentricity+servicerEccentricityOffset)^2)*cos(servicerEccentricAnomaly)/
    (1-(eccentricity+servicerEccentricityOffset)*cos(servicerEccentricAnomaly));
  tvx=u*chiefPerifocalVelocityP+uu*chiefPerifocalVelocityQ;
  tvy=v*chiefPerifocalVelocityP+vv*chiefPerifocalVelocityQ;
  tvz=w*chiefPerifocalVelocityP+ww*chiefPerifocalVelocityQ;
  svx=u*servicerPerifocalVelocityP+uu*servicerPerifocalVelocityQ;
  svy=v*servicerPerifocalVelocityP+vv*servicerPerifocalVelocityQ;
  svz=w*servicerPerifocalVelocityP+ww*servicerPerifocalVelocityQ;
  targetRadius=sqrt(tx*tx+ty*ty+tz*tz);
  separation=sqrt((sx-tx)*(sx-tx)+(sy-ty)*(sy-ty)+(sz-tz)*(sz-tz));
  orbitalPeriod=2*3.141592653589793/meanMotion;
  annotation(experiment(StartTime=0,StopTime=100,Interval=.1,Tolerance=1e-7));
end KeplerFormation;
