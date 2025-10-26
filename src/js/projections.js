// Map Projection Mathematics
// All functions take longitude/latitude in degrees and return normalized coordinates

const Projections = {
    equirectangular: (lon, lat) => {
        // Simple cylindrical projection
        // This is what we're starting with
        const x = lon / 180;  // Normalize to [-1, 1]
        const y = lat / 90;   // Normalize to [-1, 1]
        return { x, y };
    },

    mercator: (lon, lat) => {
        // Mercator projection - conformal but distorts areas
        const lonRad = lon * Math.PI / 180;
        let latRad = lat * Math.PI / 180;
        
        // Avoid infinity at poles
        const maxLat = 85 * Math.PI / 180;
        latRad = Math.max(-maxLat, Math.min(maxLat, latRad));
        
        const x = lonRad / Math.PI;  // Normalize to [-1, 1]
        const y = Math.log(Math.tan(Math.PI/4 + latRad/2)) / Math.PI;
        
        return { x, y };
    },

    mollweide: (lon, lat) => {
        // Mollweide projection - equal area but distorts shapes
        const lonRad = lon * Math.PI / 180;
        const latRad = lat * Math.PI / 180;
        
        // Iterative solution for theta
        let theta = latRad;
        for (let i = 0; i < 5; i++) {
            theta = theta - (2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(latRad)) 
                     / (2 + 2 * Math.cos(2 * theta));
        }
        
        const x = (2 * Math.sqrt(2) / Math.PI) * lonRad * Math.cos(theta);
        const y = Math.sqrt(2) * Math.sin(theta);
        
        // Normalize to similar scale as other projections
        return { x: x / 2, y: y / 2 };
    }
};

// Inverse projections: map normalized projection coords (nx,ny) back to lon/lat degrees
Projections.inverse = {
    equirectangular: (nx, ny) => {
        return { lon: nx * 180, lat: ny * 90 };
    },
    mercator: (nx, ny) => {
        const lon = nx * 180;
        const y = ny * Math.PI;
        const latRad = 2 * Math.atan(Math.exp(y)) - Math.PI / 2;
        return { lon, lat: latRad * 180 / Math.PI };
    },
    mollweide: (nx, ny) => {
        // Based on the forward implementation in Projections.mollweide
        // nx,ny are the returned values (already divided by 2 in forward)
        const x = nx; const y = ny;
        const SQRT2 = Math.SQRT2; // sqrt(2)
        // Recover theta from y: y = (sqrt(2)/2) * sin(theta) => sin(theta) = y * 2 / sqrt(2) = y * sqrt(2)
        const sinTheta = y * SQRT2;
        // clamp
        const theta = Math.asin(Math.max(-1, Math.min(1, sinTheta)));
        // Recover latitude: sin(lat) = (2*theta + sin(2*theta)) / pi
        const sinLat = (2 * theta + Math.sin(2 * theta)) / Math.PI;
        const latRad = Math.asin(Math.max(-1, Math.min(1, sinLat)));
        // Recover longitude: x = (sqrt(2)/pi) * lonRad * cos(theta)  => lonRad = x / ((sqrt(2)/pi)*cos(theta))
        const denom = (Math.SQRT2 / Math.PI) * Math.cos(theta);
        let lon = 0;
        if (Math.abs(denom) > 1e-8) lon = (x) / denom * 180 / Math.PI;
        return { lon, lat: latRad * 180 / Math.PI };
    }
};

// Tissot's Indicatrix calculation
function calculateTissot(lon, lat, projectionName, delta = 1.0) {
    const proj = Projections[projectionName];
    const dLon = delta; // degrees
    const dLat = delta; // degrees
    
    // Calculate four points around the center
    const center = proj(lon, lat);
    const right = proj(lon + dLon, lat);
    const top = proj(lon, lat + dLat);
    
    // Calculate derivatives (approximate)
    const dx_dlon = (right.x - center.x) / dLon;
    const dy_dlon = (right.y - center.y) / dLon;
    const dx_dlat = (top.x - center.x) / dLat;
    const dy_dlat = (top.y - center.y) / dLat;
    
    // First fundamental form coefficients
    const E = dx_dlon * dx_dlon + dy_dlon * dy_dlon;
    const F = dx_dlon * dx_dlat + dy_dlon * dy_dlat;
    const G = dx_dlat * dx_dlat + dy_dlat * dy_dlat;
    
    // Area scale factor
    const areaScale = Math.sqrt(E * G - F * F);
    
    return {
        center: center,
        scale: areaScale,
        ellipse: {
            a: Math.sqrt(E),
            b: Math.sqrt(G),
            angle: Math.atan2(F, E)
        }
    };
}

export { Projections, calculateTissot };