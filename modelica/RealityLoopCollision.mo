package RealityLoopCollision
  // Contact geometry is evaluated entirely in Modelica and compiled by Rumoca.
  // External backends may implement the same geometric queries, but do not
  // own the equations of motion or advance the physical state.

  function circleAabb2D
    input Real x "Circle centre X [m]";
    input Real z "Circle centre Z [m]";
    input Real cx "AABB centre X [m]";
    input Real cz "AABB centre Z [m]";
    input Real halfX "AABB half-length X [m]";
    input Real halfZ "AABB half-width Z [m]";
    input Real radius "Contact circle radius [m]";
    output Real result[3] "{penetration [m], normalX, normalZ}";
  protected
    Real outsideX;
    Real outsideZ;
    Real range;
  algorithm
    outsideX := max(abs(x-cx)-halfX,0);
    outsideZ := max(abs(z-cz)-halfZ,0);
    range := sqrt(outsideX^2+outsideZ^2);
    // Retain the baseline supermarket 2D contact semantics for parity.
    result[1] := max(0,radius-range);
    result[2] := if range>1e-9 then
      (if x>cx then outsideX else -outsideX)/range
      else if x<cx then -1 else 1;
    result[3] := if range>1e-9 then
      (if z>cz then outsideZ else -outsideZ)/range else 0;
  end circleAabb2D;

  function analyticBoxContact
    // Common per-body Modelica contact-query signature. A body index permits
    // a redeclared mesh implementation without changing vehicle dynamics.
    input Integer bodyIndex;
    input Real x;
    input Real z;
    input Real cx;
    input Real cz;
    input Real halfX;
    input Real halfZ;
    input Real radius;
    output Real result[3];
  algorithm
    result := circleAabb2D(x,z,cx,cz,halfX,halfZ,radius);
  end analyticBoxContact;

  function nearestOnSegment
    input Real p[3];
    input Real a[3];
    input Real b[3];
    output Real closest[3];
  protected
    Real ab[3];
    Real d2;
    Real alpha;
  algorithm
    ab := b-a;
    d2 := sum(ab .* ab);
    alpha := if d2>1e-24 then max(0,min(1,sum((p-a).*ab)/d2))
      else 0;
    closest := a+alpha*ab;
  end nearestOnSegment;

  function nearestOnTriangle
    input Real p[3] "Query point in metres";
    input Real a[3];
    input Real b[3];
    input Real c[3];
    output Real closest[3];
  protected
    Real ab[3];
    Real ac[3];
    Real ap[3];
    Real normal[3];
    Real normal2;
    Real projected[3];
    Real aa;
    Real bb;
    Real cc;
    Real u;
    Real v;
    Real w;
    Real denominator;
    Real qAB[3];
    Real qBC[3];
    Real qCA[3];
    Real dAB;
    Real dBC;
    Real dCA;
  algorithm
    ab := b-a;
    ac := c-a;
    ap := p-a;
    normal := {ab[2]*ac[3]-ab[3]*ac[2],
      ab[3]*ac[1]-ab[1]*ac[3],ab[1]*ac[2]-ab[2]*ac[1]};
    normal2 := sum(normal .* normal);
    projected := if normal2>1e-24 then
      p-sum(ap.*normal)/normal2*normal else p;
    aa := sum(ab .* ab);
    bb := sum(ab .* ac);
    cc := sum(ac .* ac);
    denominator := aa*cc-bb*bb;
    u := if denominator>1e-24 then
      (cc*sum((projected-a).*ab)-bb*sum((projected-a).*ac))/denominator
      else -1;
    v := if denominator>1e-24 then
      (aa*sum((projected-a).*ac)-bb*sum((projected-a).*ab))/denominator
      else -1;
    w := 1-u-v;
    if u>=0 and v>=0 and w>=0 then
      closest := projected;
    else
      // Outside the face: project to the closest of its 3 finite edges.
      // This also handles degenerate triangles without NaN barycentrics.
      qAB := nearestOnSegment(p,a,b);
      qBC := nearestOnSegment(p,b,c);
      qCA := nearestOnSegment(p,c,a);
      dAB := sum((p-qAB).*(p-qAB));
      dBC := sum((p-qBC).*(p-qBC));
      dCA := sum((p-qCA).*(p-qCA));
      closest := if dAB<=dBC and dAB<=dCA then qAB else
        if dBC<=dCA then qBC else qCA;
    end if;
  end nearestOnTriangle;

  function sphereTriangle
    input Real center[3] "Sphere centre [m]";
    input Real radius "Sphere radius [m]";
    input Real a[3];
    input Real b[3];
    input Real c[3];
    output Real result[8]
      "{depth [m], normal[3], closest point[3], unsigned distance [m]}";
  protected
    Real closest[3];
    Real delta[3];
    Real separation;
    Real ab[3];
    Real ac[3];
    Real crossNormal[3];
    Real normNormal;
  algorithm
    closest := nearestOnTriangle(center,a,b,c);
    delta := center-closest;
    separation := sqrt(sum(delta.*delta));
    ab := b-a;
    ac := c-a;
    crossNormal := {ab[2]*ac[3]-ab[3]*ac[2],
      ab[3]*ac[1]-ab[1]*ac[3],ab[1]*ac[2]-ab[2]*ac[1]};
    normNormal := sqrt(sum(crossNormal.*crossNormal));
    result[1] := max(0,radius-separation);
    result[2:4] := if separation>1e-12 then delta/separation else
      if normNormal>1e-12 then crossNormal/normNormal else {0,1,0};
    result[5:7] := closest;
    result[8] := separation;
  end sphereTriangle;

  function sphereMesh
    input Real center[3] "Sphere centre [m]";
    input Real radius "Sphere radius [m]";
    input Integer nVertices;
    input Integer nTriangles;
    input Real vertices[nVertices,3] "World-frame mesh vertices [m]";
    input Integer triangles[nTriangles,3] "1-based mesh vertex triplets";
    output Real result[9]
      "{depth, normal[3], closest[3], unsigned distance, triangle ID}";
  protected
    Real sample[8];
    Real nearest[8];
    Real minimumDistance;
    Integer nearestFace;
  algorithm
    minimumDistance := 1e100;
    nearestFace := 0;
    nearest := {0,0,1,0,0,0,0,1e100};
    for i in 1:nTriangles loop
      sample := sphereTriangle(center,radius,
        vertices[triangles[i,1],:],
        vertices[triangles[i,2],:],
        vertices[triangles[i,3],:]);
      if sample[8]<minimumDistance then
        minimumDistance := sample[8];
        nearestFace := i;
        nearest := sample;
      end if;
    end for;
    result[1:8] := nearest;
    result[9] := nearestFace;
  end sphereMesh;

  function sphereClosedMeshRegion
    // Select a named solid body from the canonical packed triangle buffer.
    // Face indices are global vertex indices (no geometry copied/reshaped).
    input Real center[3];
    input Real radius;
    input Integer nVertices;
    input Integer nTriangles;
    input Real vertices[nVertices,3];
    input Integer triangles[nTriangles,3];
    input Integer firstFace;
    input Integer faceCount;
    output Real result[10];
  protected
    Integer bodyFaces[faceCount,3];
  algorithm
    for i in 1:faceCount loop
      bodyFaces[i,:] := triangles[firstFace+i-1,:];
    end for;
    result := sphereClosedMesh(center,radius,nVertices,faceCount,
      vertices,bodyFaces);
  end sphereClosedMeshRegion;

  function meshWindingNumberRegion
    // Packed multi-body assets require winding tests over the selected
    // closed body only; nearest-surface and inside queries must agree.
    input Real point[3];
    input Integer nVertices;
    input Integer nTriangles;
    input Real vertices[nVertices,3];
    input Integer triangles[nTriangles,3];
    input Integer firstFace;
    input Integer faceCount;
    output Real winding;
  protected
    Integer bodyFaces[faceCount,3];
  algorithm
    for i in 1:faceCount loop
      bodyFaces[i,:] := triangles[firstFace+i-1,:];
    end for;
    winding := meshWindingNumber(point,nVertices,faceCount,vertices,bodyFaces);
  end meshWindingNumberRegion;

  function meshWindingNumber
    input Real p[3] "Query point [m]";
    input Integer nVertices;
    input Integer nTriangles;
    input Real vertices[nVertices,3];
    input Integer triangles[nTriangles,3];
    output Real winding "Signed winding number (1 inside, 0 outside)";
  protected
    Real a[3];
    Real b[3];
    Real c[3];
    Real crossBC[3];
    Real lA;
    Real lB;
    Real lC;
    Real numerator;
    Real denominator;
    Real angle;
  algorithm
    angle := 0;
    for i in 1:nTriangles loop
      a := vertices[triangles[i,1],:]-p;
      b := vertices[triangles[i,2],:]-p;
      c := vertices[triangles[i,3],:]-p;
      lA := sqrt(sum(a.*a));
      lB := sqrt(sum(b.*b));
      lC := sqrt(sum(c.*c));
      crossBC := {b[2]*c[3]-b[3]*c[2],
        b[3]*c[1]-b[1]*c[3],b[1]*c[2]-b[2]*c[1]};
      numerator := sum(a.*crossBC);
      denominator := lA*lB*lC+sum(a.*b)*lC+
        sum(b.*c)*lA+sum(c.*a)*lB;
      if abs(numerator)>1e-20 or abs(denominator)>1e-20 then
        angle := angle+2*atan2(numerator,denominator);
      end if;
    end for;
    winding := angle/12.566370614359172;
  end meshWindingNumber;

  function sphereClosedMesh
    // A *topologically validated closed, consistently oriented* triangle mesh.
    // Inside is determined by solid-angle winding, not an AABB guess.
    // For non-watertight surfaces use sphereMesh (two-sided) instead.
    input Real center[3];
    input Real radius;
    input Integer nVertices;
    input Integer nTriangles;
    input Real vertices[nVertices,3];
    input Integer triangles[nTriangles,3];
    output Real result[10]
      "{solid depth, normal[3], closest[3], unsigned distance, face, inside}";
  protected
    Real nearest[9];
    Real winding;
    Boolean inside;
  algorithm
    nearest := sphereMesh(center,radius,nVertices,nTriangles,vertices,triangles);
    winding := meshWindingNumber(center,nVertices,nTriangles,vertices,triangles);
    inside := abs(winding)>0.5;
    result[1:9] := nearest;
    if inside then
      result[1] := radius+nearest[8];
      if nearest[8]>1e-12 then
        result[2:4] := -nearest[2:4];
      end if;
    end if;
    result[10] := if inside then 1 else 0;
  end sphereClosedMesh;
  function sphereMeshBvh
    // Traverse a precomputed median-split BVH in compiled Modelica. An AABB
    // bound can only reject a triangle when it cannot improve the closest hit.
    input Real center[3];
    input Real radius;
    input Integer nVertices;
    input Integer nTriangles;
    input Real vertices[nVertices,3];
    input Integer triangles[nTriangles,3];
    input Integer nNodes;
    input Integer root;
    input Real boundsMin[nNodes,3];
    input Real boundsMax[nNodes,3];
    input Integer left[nNodes];
    input Integer right[nNodes];
    input Integer leafStart[nNodes];
    input Integer leafCount[nNodes];
    input Integer triangleOrder[nTriangles];
    output Real result[11]
      "{depth, normal[3], closest[3], unsigned distance, face, triangles tested, nodes visited}";
  protected
    Integer stack[nNodes];
    Integer top;
    Integer node;
    Integer face;
    Integer tests;
    Integer visits;
    Real dx;
    Real dy;
    Real dz;
    Real boundSq;
    Real bestSq;
    Real candidate[8];
    Real nearest[8];
    Real distanceSq;
    Integer closestFace;
  algorithm
    stack := fill(0,nNodes);
    top := 1;
    stack[1] := root;
    tests := 0;
    visits := 0;
    bestSq := 1e200;
    closestFace := 0;
    nearest := {0,0,1,0,0,0,0,1e100};
    for iter in 1:nNodes loop
      if top>0 then
        node := stack[top];
        top := top-1;
        visits := visits+1;
        dx := max(max(boundsMin[node,1]-center[1],
                      center[1]-boundsMax[node,1]),0);
        dy := max(max(boundsMin[node,2]-center[2],
                      center[2]-boundsMax[node,2]),0);
        dz := max(max(boundsMin[node,3]-center[3],
                      center[3]-boundsMax[node,3]),0);
        boundSq := dx*dx+dy*dy+dz*dz;
        if boundSq<=bestSq+1e-18 then
          if left[node]>0 then
            top := top+1;
            stack[top] := right[node];
            top := top+1;
            stack[top] := left[node];
          else
            // Offline geometry compilation uses leaves of at most four
            // triangles. A fixed loop domain keeps Rumoca's solver lowering
            // valid; data-dependent iteration limits are not supported.
            for k in 1:4 loop
              if k<=leafCount[node] then
                face := triangleOrder[leafStart[node]+k-1];
                candidate := sphereTriangle(center,radius,
                  vertices[triangles[face,1],:],
                  vertices[triangles[face,2],:],
                  vertices[triangles[face,3],:]);
                tests := tests+1;
                distanceSq := candidate[8]*candidate[8];
                if distanceSq<bestSq then
                  bestSq := distanceSq;
                  closestFace := face;
                  nearest := candidate;
                end if;
              end if;
            end for;
          end if;
        end if;
      end if;
    end for;
    result[1:8] := nearest;
    result[9] := closestFace;
    result[10] := tests;
    result[11] := visits;
  end sphereMeshBvh;

  function sphereClosedMeshBvh
    // For a selected watertight, outward-wound body within a packed mesh.
    // Both the BVH root and winding range must refer to the SAME body.
    input Real center[3];
    input Real radius;
    input Integer nVertices;
    input Integer nTriangles;
    input Real vertices[nVertices,3];
    input Integer triangles[nTriangles,3];
    input Integer nNodes;
    input Integer root;
    input Real boundsMin[nNodes,3];
    input Real boundsMax[nNodes,3];
    input Integer left[nNodes];
    input Integer right[nNodes];
    input Integer leafStart[nNodes];
    input Integer leafCount[nNodes];
    input Integer triangleOrder[nTriangles];
    input Integer firstFace;
    input Integer faceCount;
    output Real result[12]
      "{solid depth, normal[3], closest[3], unsigned dist, face, inside, triangles tested, nodes visited}";
  protected
    Real nearest[11];
    Real winding;
    Boolean inside;
  algorithm
    nearest := sphereMeshBvh(center,radius,nVertices,nTriangles,
      vertices,triangles,nNodes,root,boundsMin,boundsMax,
      left,right,leafStart,leafCount,triangleOrder);
    winding := meshWindingNumberRegion(center,nVertices,nTriangles,
      vertices,triangles,firstFace,faceCount);
    inside := abs(winding)>0.5;
    result[1:9] := nearest[1:9];
    if inside then
      result[1] := radius+nearest[8];
      if nearest[8]>1e-12 then
        result[2:4] := -nearest[2:4];
      end if;
    end if;
    result[10] := if inside then 1 else 0;
    result[11] := nearest[10];
    result[12] := nearest[11];
  end sphereClosedMeshBvh;
end RealityLoopCollision;
