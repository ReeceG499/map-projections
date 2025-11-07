// All functions take longitude/latitude in degrees and return normalized coordinates

const Projections = {
    equirectangular: (lon, lat) => {
        // Simple cylindrical projection
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
    },

    bonne: (lon, lat) => {
        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;
        
        const lat0 = 45 * Math.PI / 180; 
        const lon0 = 0; // Central Meridian (lambda_0)
        
        // Radius of the parallel of latitude
        const rho = (1 / Math.tan(lat0)) + lat0 - latRad;
        if (rho <= 0) return null;
        
        // Angle of rotation (E)
        const E = ((lonRad - lon0) * Math.cos(latRad)) / rho;
        
        // Calculate the raw coordinates
        const x = rho * Math.sin(E);
        const y = (1 / Math.tan(lat0)) - rho * Math.cos(E);
        
        const scaleFactor = 2;
        const verticalCenterShift = -0.5; 

        // Shift y_raw to center the heart shape, then scale both coordinates down
        const x_final = x / scaleFactor;
        const y_final = (y - verticalCenterShift) / scaleFactor;
        
        return { 
            x: x_final, 
            y: y_final 
        };
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
    },
    bonne: (nx, ny) => {
        const scaleFactor = 2;        
        const verticalCenterShift = -0.5; 
        
        // 1. Reverse Scale (Denormalize)
        const x_scaled = nx * scaleFactor;
        const y_scaled = ny * scaleFactor;
        
        // 2. Reverse Shift (Uncenter)
        const x = x_scaled;
        const y = y_scaled + verticalCenterShift;
        const lat0 = 45 * Math.PI / 180;
        const lon0 = 0; // central meridian at 0°
        
        const cot_lat0 = 1 / Math.tan(lat0);
        const rho = Math.sqrt(x * x + Math.pow(cot_lat0 - y, 2));
        
        // Calculate latitude
        const latRad = cot_lat0 + lat0 - rho;
        

        if (latRad > Math.PI / 2 || latRad < -Math.PI / 2) {
            return null; // This coordinate is invalid
        }

        const POLE_LIMIT_RAD = 89.999 * Math.PI / 180; 
        if (Math.abs(latRad) >= POLE_LIMIT_RAD) {
            // At the pole, longitude is 0.
            return { lon: 0, lat: latRad > 0 ? 90 : -90 };
        }

        // Calculate longitude
        const E = Math.atan2(x, cot_lat0 - y);
        const lonRad = lon0 + (rho * E) / Math.cos(latRad);
        
        // --- FINAL FIX (Rings of Noise) ---
        const MAX_LON_RAD = 181 * Math.PI / 180; // Allow a tiny buffer
        
        // If the longitude is calculated outside the map's extent, skip it.
        if (Math.abs(lonRad) > MAX_LON_RAD) {
            return null;
        }

        return {
            lon: lonRad * 180 / Math.PI,
            lat: latRad * 180 / Math.PI
        }
    }
};

export { Projections };