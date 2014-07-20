queue()
  .defer(d3.json, 'stops.topo.json')
  .defer(d3.json, 'zurich-city.topo.json')
  .await(function (err, zhStops, zhCity) {

    // Prepare data
    // ///////////////////////////////////////////////////////////////////

    // Make necessary features
    var stopsData = topojson.feature(zhStops, zhStops.objects.stops).features,
        cityData  = topojson.mesh(zhCity, zhCity.objects['zurich-city']);


    var getX = function (d) { return d.geometry.coordinates[0]; },
        getY = function (d) { return d.geometry.coordinates[1]; },
        xMin = d3.min(stopsData, getX),
        yMin = d3.min(stopsData, getY),
        xMax = d3.max(stopsData, getX),
        yMax = d3.max(stopsData, getY);

    var cityBounds = d3.geo.bounds(cityData),
        x0 = cityBounds[0][0], y0 = cityBounds[0][1],
        x1 = cityBounds[1][0], y1 = cityBounds[1][1];

    var withInCityBounds = function (coords) {
        var x = coords[0], y = coords[1];
        return x0 <= x && x <= x1 && y0 <= y && y <= y1;
    };

    // This is data gathered from maps.google.com, using the Distance plugin
    // from the Classic Google Maps Lab. I trust this data more than doing
    // calculations based on what the radius of the Earth is manually.
    //
    // Bounding box of the map is:
    // [47.29513, 8.35466166666667] x [47.4521055555556, 8.6847075]
    // I do not really know to how many significant digits these are accurate.
    //
    // These are the distance values via Google maps:
    //
    // 47.29513,8.35466166666667 to 47.4521055555556,8.35466166666667
    //   == 17.3524 km
    //
    // So 0.001 change in latitude = 0.11054205184102167 km
    //
    // 47.29513,8.35466166666667 to 47.29513,8.6847075
    //   == 24.9250 km
    //
    // So 0.001 change in longitude = 0.07551981416722511 km
    //
    // Sanity check:
    // 47.29513,8.35466166666667 to 47.4521055555556,8.6847075
    //   == 30.3582 km
    //   == sqrt( 17.3524^2 + 24.9250^2 )
    //
    // Math.sqrt(Math.pow(17.3524, 2) + Math.pow(24.9250, 2)) - 30.3582
    //   == 0.012203533045127557
    //


    // Draw stuff!
    // ///////////////////////////////////////////////////////////////////

    // Remove the loading message
    d3.select('#loading-message').remove();


    // Dimensions
    var width  = 960,
        height = 480;

    // Root element
    var svg = d3.select('body').append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('viewBox', '0 0 ' + width + ' ' + height);

    // The projection to use
    var projection = d3.geo.mercator()
                        .center([(xMin + xMax) / 2, (yMin + yMax) / 2])
                        .translate([width / 2, height / 2])
                        .scale(110000);

    // The path generator
    var pathGenerator = d3.geo.path()
                            .projection(projection)
                            // Make the dots really small
                            .pointRadius(1);

    // Draw the stops, but only those which are inside the city's bounding box.
    var stopsG = svg.append('g')
                    .classed('stops', true);

    var stopsWithinCityBounds = stopsData.filter(function (sd) {
        return withInCityBounds(sd.geometry.coordinates);
    });

    stopsG.selectAll('.stop')
        .data(stopsWithinCityBounds)
      .enter()
        .append('path')
        .classed('stop', true)
        .attr('data-stop-name', function (d) { return d.properties.stopName; })
        .attr('d', pathGenerator);

    // Draw the overall boundary underneath the states and the stops to be
    // least intrusive for interaction.
    svg.append('path')
        .datum(cityData)
        .classed('boundary', true)
        .attr('d', pathGenerator);

    // Rotate through the entire spectrum of colors available.
    var colors = d3.scale.category20();

    var ids = zhCity.objects['zurich-city']
                .geometries.map(function (d) { return d.id; });

    var regionsG = svg.append('g')
                    .classed('regions', true);

    // Draw boundaries of each Zurich region
    ids.forEach(function (id, idx) {
        regionsG.append('path')
            .datum(topojson.mesh(zhCity, zhCity.objects['zurich-city'],
                    // Draw the boundary if the current region lies on any
                    // side. This probably can be made more efficient.
                    function (a, b) { return a.id === id || b.id === id; }))
            .classed('region', true)
            .attr('data-name', function (d) { return id; })
            .attr('stroke', colors(idx))
            .attr('title', function (d) { return id; })
            .attr('d', pathGenerator);
    });

    var _uniqueCoords = {};
    var uniqueStops = stopsWithinCityBounds.filter(function (d) {
        var key = d.geometry.coordinates.join('##');
        if (_uniqueCoords.hasOwnProperty(key)) {
            return false;
        } else {
            _uniqueCoords[key] = true;
            return true;
        }
    });

    // Prepare the Voronoi points.
    var voronoiPts = uniqueStops.map(function (d) {
        return projection(d.geometry.coordinates);
    });

    var voronoiPolygons = d3.geom.voronoi(voronoiPts);

    var voronoiG = svg.append('g')
                    .classed('voronoi-polygons', true);

    // Draw the vornoi polygons
    voronoiG.selectAll('path.voronoi-polygon')
        .data(voronoiPolygons)
      .enter()
        .append('path')
        .classed('voronoi-polygon', true)
        .attr('d', function (polygon, idx) {
            return "M" + polygon.join('L') + 'Z';
        });


    window.zhStops = zhStops;
    window.zhCity = zhCity;
});
