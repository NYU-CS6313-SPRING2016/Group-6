import React, { Component, PropTypes } from 'react';
import L from 'leaflet-headless';
import d3 from 'd3';
import QuadTree from './QuadTree';
global.QuadTree = QuadTree

const NYC = [40.7317, -73.9841];

const MIN_RADIUS = 3;
const radiusScale = d3.scale.sqrt();

/* eslint-disable no-param-reassign */

function bottomUp(node, base, recursive) {
  let ret;
  if (node.leaf) {
    ret = base(node);
  } else {
    const nodes = node.nodes.filter(e => e);
    ret = recursive(node, nodes);
  }
  return ret;
}

class TweetMap extends Component {

  static propTypes = {
    tweets: PropTypes.array.isRequired,
    newTweetLocation: PropTypes.object,
    nodesInBounds: PropTypes.array,
    onBoundsChange: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.map = L.map('map').setView(NYC, 12);
    L.tileLayer('http://{s}.sm.mapstack.stamen.com/(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/{z}/{x}/{y}.png').addTo(this.map);
    this.map.on('moveend', this._updateBounds.bind(this));
    this._updateBounds();

    this.svg = d3
      .select(this.map.getPanes().overlayPane)
      .append('svg');

    this.g = this.svg
      .append('g')
      .attr('class', 'leaflet-zoom-hide tweet-locations');

    const _map = this.map;
    function projectPoint(x, y) {
      const point = _map.latLngToLayerPoint(new L.LatLng(y, x));
      this.stream.point(point.x, point.y);
    }

    const transform = d3.geo.transform({ point: projectPoint });
    this.path = d3.geo.path().projection(transform);
  }

  _updateBounds() {
    const bounds = this.map.getBounds();
    this.props.onBoundsChange([bounds.getWest(),
                               bounds.getSouth(),
                               bounds.getEast(),
                               bounds.getNorth()]);
  }

  makeClusters(quadtree) {
    const clusters = [];
    const size = this.map.getSize();
    const maxRadius = Math.min(size.x, size.y) / 15;
    this.rscale = radiusScale
            .domain([1, quadtree.size])
            .range([MIN_RADIUS, maxRadius]);
    let id = 0;
    quadtree.visit((node) => {
      node.id = id++;
    });
    quadtree.visit((node, x1, y1, x2, y2) => {
      const radius = this.rscale(node.size);
      const bound = Math.min(x2 - x1, y2 - y1) * 0.2;
      if (bound <= radius) {
        clusters.push(node);
        return true;
      }
      if (node.leaf) {
        clusters.push(node);
      }
      return false;
    });
    return clusters;
  }


  redrawSubset(nodes) {
    if (!nodes.length) return;
    const features = [].concat(...nodes.map(d => d.geo));

    const bounds = this.path.bounds({ type: 'FeatureCollection', features });
    const padding = 100;
    const topLeft = bounds[0].map(x => x - padding);
    const bottomRight = bounds[1].map(x => x + padding);
    this.svg.attr('width', bottomRight[0] - topLeft[0])
      .attr('height', bottomRight[1] - topLeft[1])
      .style('left', `${topLeft[0]}px`)
      .style('top', `${topLeft[1]}px`);
    this.g.attr('transform', `translate(${-topLeft[0]}, ${-topLeft[1]})`);

    /*
    const projected = subset.map(feature => ({
      id_str: feature.id_str,
      text: feature.text,
      name: feature.name,
      x: this.path.centroid(feature)[0],
      y: this.path.centroid(feature)[1],
    }));
    const groups = d3.geom.quadtree(projected);
    const clusters = this.makeClusters(groups);
    // TODO use clusters
    const points = this.g.selectAll('circle')
          .data(clusters, d => d.id);
    points.enter().append('circle').style({
      fill: '#ffd800',
      opacity: 0.6,
    });
    points.exit().remove();
    points.attr({
      cx: d => d.cx,
      cy: d => d.cy,
      r: d => this.rscale(d.size),
    });

    points.style('fill-opacity', d => d.group ? (d.group * 0.1) + 0.2 : 1);
    */
    const projected = nodes.map(nd => ({
      topLeft: this.path.centroid(nd.geo[0]),
      bottomRight: this.path.centroid(nd.geo[1]),
      id: nd.id,
      node: nd.node,
    }));
    projected.forEach(d => {
      d.width = d.bottomRight[0] - d.topLeft[0];
      d.height = d.bottomRight[1] - d.topLeft[1];
      d.centroid = this.path.centroid({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: d.node.centroid,
        },
      });
    });

    const rects = this.g.selectAll('rect').data(projected, d => d.id);
    rects.enter().append('rect');
    rects.exit().remove();
    rects.attr({
      x: nd => nd.topLeft[0],
      y: nd => nd.topLeft[1],
      width: nd => nd.width,
      height: nd => nd.height,
    }).style({
      stroke: 'blue',
      fill: 'none',
    });

    const sizes = this.g.selectAll('text').data(projected, d => d.id);
    sizes.enter().append('text').text(d => d.node.size);
    sizes.exit().remove();
    sizes.attr({
      x: d => d.centroid[0],
      y: d => d.centroid[1],
    }).style({
      'text-anchor': 'center',
      fill: 'yellow',
    });
  }


  render() {
    const nodes = this.props.nodesInBounds;
    if (nodes) {
      const rects = nodes.map(nd => ({
        geo: [{
          type: 'Feature',
          geometry: { coordinates: [nd.l, nd.b], type: 'Point' },
        }, {
          type: 'Feature',
          geometry: { coordinates: [nd.r, nd.t], type: 'Point' },
        }],
        id: nd.id,
        node: nd,
      }));
      this.redrawSubset(rects);
    }

    return (
      <div id="map" style={{ minHeight: '200px' }} className="App_fill_2Je">
      </div>
    );
  }

}

export default TweetMap;
