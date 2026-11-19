package RealityLoopProviders
  function doubled
    input Real x;
    input Real z;
    input Real cx;
    input Real cz;
    input Real halfX;
    input Real halfZ;
    input Real radius;
    output Real result[3];
  algorithm
    result := RealityLoopCollision.circleAabb2D(
      x,z,cx,cz,halfX,halfZ,radius);
    result[1] := 2*result[1];
  end doubled;

  model DefaultProbe
    replaceable function collision = RealityLoopCollision.circleAabb2D;
    Real contact[3];
    Real depth;
  equation
    contact=collision(time,0,0.5,0,0.5,1,0.2);
    depth=contact[1];
    annotation(experiment(StartTime=0,StopTime=1,Interval=0.05));
  end DefaultProbe;

  model AlternateProbe
    extends DefaultProbe(redeclare function collision = RealityLoopProviders.doubled);
  end AlternateProbe;
end RealityLoopProviders;
