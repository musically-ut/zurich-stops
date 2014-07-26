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
    var width  = 1000,
        height = 1000,
        transitionDuration = 750;


    // Root element
    var svg = d3.select('body').append('svg')
                .attr('viewBox', '0 0 ' + width + ' ' + height);

    var zoomableG = svg.append('g');

    // The projection to use
    var projection = d3.geo.mercator()
                        .center([(xMin + xMax) / 2, (yMin + yMax) / 2])
                        .translate([width / 2, height / 2])
                        .scale(250000);

    // The path generator
    var pathGenerator = d3.geo.path()
                            .projection(projection)
                            // Make the dots small
                            .pointRadius(1.5);


    // Draw the state boundaries
    // ///////////////////////////////////////////////////////////////////////

    var regionsG = zoomableG.append('g')
                    .classed('regions', true);

    // Draw the regions
    regionsG.selectAll('path.region')
        .data(topojson.feature(zhCity, zhCity.objects['zurich-city']).features)
      .enter().append('path')
        .classed('region', true)
        .attr('d', pathGenerator);

    // Draw their boundaries
    regionsG.append('path')
        .datum(topojson.mesh(zhCity, zhCity.objects['zurich-city']))
        .classed('boundary', true)
        .attr('d', pathGenerator);

    // Stops
    // ///////////////////////////////////////////////////////////////////////

    // Draw the stops, but only those which are inside the city's bounding box.
    var stopsG = zoomableG.append('g')
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

    // Voronoi tesselation
    // ///////////////////////////////////////////////////////////////////////

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

    var voronoiG = zoomableG.append('g')
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

    // Add interaction
    // ///////////////////////////////////////////////////////////////////////


    // Zoom behaviour
    function zoomed() {
        regionsG.selectAll('path.boundary')
            .style('stroke-width', 3 / d3.event.scale + 'px');

        voronoiG.selectAll('path.voronoi-polygon')
            .style('stroke-width', 3 / d3.event.scale + 'px');

        zoomableG.attr(
            'transform'
          , 'translate(' + d3.event.translate + ')'
            + 'scale(' + d3.event.scale + ')'
        );
    }
    var zoom = d3.behavior.zoom()
                .translate([0, 0])
                .scale(1)
                .scaleExtent([1, 8])
                .on('zoom', zoomed);

    svg
      .call(zoom)
      .call(zoom.event);

    window.zhStops = zhStops;
    window.zhCity = zhCity;
});
