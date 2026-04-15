const svg = d3.select("#map");
const tooltip = d3.select("#tooltip");

//group for zoom/pan
const gMap = svg.append("g").attr("class", "map-inner");

const gMarkers = svg.append("g").attr("class", "marker-layer");

//filter checkboxes
const treatsCheckbox = document.getElementById("filter-treats");
const waterCheckbox  = document.getElementById("filter-water");
const beachCheckbox  = document.getElementById("filter-beach");
const parkCheckbox   = document.getElementById("filter-park");

const width = svg.node().clientWidth;
const height = svg.node().clientHeight;
const mapInnerHeight = height - 80;

svg.attr("width", width).attr("height", height);

function bringToFront(el) {
  if (el && el.parentNode) {
    el.parentNode.appendChild(el);
  }
}

//load map and data
Promise.all([
  d3.json("sf_neighborhoods.json"),
  d3.csv("sftreats.csv")
]).then(([sfData, points]) => {

  const neighborhoodsObject = Object.values(sfData.objects)[0];
  const neighborhoods = topojson.feature(sfData, neighborhoodsObject);

  const allFeatures = neighborhoods.features.concat(
    points.map(d => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [+d.Longitude, +d.Latitude]
      }
    }))
  );

  const projection = d3.geoMercator()
    .fitSize(
      [width, height],
      { type: "FeatureCollection", features: allFeatures }
    );

  const path = d3.geoPath().projection(projection);

  //draw neighborhoods
  gMap.append("g")
    .attr("class", "neighborhoods")
    .selectAll("path")
    .data(neighborhoods.features)
    .enter()
    .append("path")
    .attr("class", "neighborhood")
    .attr("d", path);

  //emoji categories
  const categories = Array.from(new Set(points.map(d => d.Category))).sort();

  const emojiMap = {
    "Bar": "🍺",
    "Beach": "🏖️",
    "Cafe": "☕",
    "Dessert": "🍰",
    "Dog Bakery": "🦴",
    "Park": "🌳",
    "Restaurant": "🍔"
  };

  //emoji legend
  const legend = d3.select("#legend")
    .selectAll(".legend-item")
    .data(categories)
    .enter()
    .append("div")
    .attr("class", "legend-item");

  legend.append("span")
    .attr("class", "legend-emoji")
    .text(d => emojiMap[d] || "🐾");

  legend.append("span")
    .text(d => d);

  function projectedPoint(d, transform) {
    const [x, y] = projection([+d.Longitude, +d.Latitude]);
    if (!transform) return [x, y];
    return [transform.applyX(x), transform.applyY(y)];
  }

  let currentSelected = null;

  //place markers
  const markers = gMarkers
    .selectAll("text")
    .data(points)
    .enter()
    .append("text")
    .attr("class", "emoji-marker")
    .text(d => emojiMap[d.Category] || "🐾")
    .style("font-size", "22px")
    .style("cursor", "pointer")
    .style("pointer-events", "visible")
    .attr("x", d => projectedPoint(d)[0])
    .attr("y", d => projectedPoint(d)[1])
    
    //tooltip
    .on("click", function(event, d) {
      bringToFront(this);

      if (currentSelected === d) {
        currentSelected = null;
        tooltip.style("opacity", 0);
        return;
      }

      currentSelected = d;

      const hasTreats = d["Dog Treats"] === "Y";
      const hasWater  = d["Water Bowls"] === "Y";

      const flagsHtml = [
        hasTreats ? "<span>🐾 Treats</span>" : "",
        hasWater  ? "<span>💧 Water</span>"  : ""
      ].join("");

      tooltip
        .style("opacity", 1)
        .html(`
          <div class="tooltip-title">${d.Name}</div>
          <div class="tooltip-category">
            ${d.Category}${d.Neighborhood ? " · " + d.Neighborhood : ""}
          </div>
          <div class="tooltip-address">${d.Address || ""}</div>
          ${flagsHtml ? `<div class="tooltip-flags">${flagsHtml}</div>` : ""}
          <div class="tooltip-description">${d.Description || ""}</div>
        `)
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY + 12) + "px");
    });

  //filters
  function updateFilters() {
    const filterTreats = treatsCheckbox.checked;
    const filterWater  = waterCheckbox.checked;
    const filterBeach  = beachCheckbox.checked;
    const filterPark   = parkCheckbox.checked;

    const anyActive = filterTreats || filterWater || filterBeach || filterPark;

    markers.style("display", d => {
      if (!anyActive) return null;
      let match = false;

      if (filterTreats && d["Dog Treats"] === "Y") match = true;
      if (filterWater  && d["Water Bowls"] === "Y") match = true;
      if (filterBeach  && d.Category === "Beach") match = true;
      if (filterPark   && d.Category === "Park") match = true;

      return match ? null : "none";
    });

    currentSelected = null;
    tooltip.style("opacity", 0);
  }

  treatsCheckbox.addEventListener("change", updateFilters);
  waterCheckbox.addEventListener("change", updateFilters);
  beachCheckbox.addEventListener("change", updateFilters);
  parkCheckbox.addEventListener("change", updateFilters);

  //zoom/pan
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
      gMap.attr("transform", event.transform);

      markers
        .attr("x", d => projectedPoint(d, event.transform)[0])
        .attr("y", d => projectedPoint(d, event.transform)[1]);

      tooltip.style("opacity", 0);
      currentSelected = null;
    });

  svg.call(zoom);
});
