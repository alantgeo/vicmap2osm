const CheapRuler = require('cheap-ruler')
const ruler = new CheapRuler(-37, 'meters')

/**
 * Cluster points together where within threshold distance.
 *
 * @param {Array} features - GeoJSON Point Features
 * @param {number} thresholdDistance - Maximum distance between points to cluster together
 *
 * @returns {Array} clusters, where unclustered features are returned as single feature clusters
 */
module.exports = (features, thresholdDistance) => {
  // Array of clusters where each cluster is a Set of feature index's
  const clusters = []

  features.map((a, ai) => {
    features.map((b, bi) => {
      // skip comparing with self
      if (ai === bi) return

      const distance = ruler.distance(a.geometry.coordinates, b.geometry.coordinates)                                                        
      if (distance < thresholdDistance) {
        // link into a cluster
        let addedToExistingCluster = false
        clusters.forEach((cluster, i) => {
          if (cluster.has(ai) || cluster.has(bi)) {
            // insert into this cluster
            clusters[i].add(ai)
            clusters[i].add(bi)

            addedToExistingCluster = true
          }
        })

        if (!addedToExistingCluster) {
          // create a new cluster
          const newCluster = new Set()
          newCluster.add(ai)
          newCluster.add(bi)
          clusters.push(newCluster)
        }
      } // else don't cluster together
    })
  })

  // result is array of clusters, including non-clustered features as single item clusters
  const result = clusters.map(cluster => {
    return Array.from(cluster).map(index => {
      return features[index]
    })
  })

  // find features not clustered
  features.map((feature, index) => {
    // if feature not a cluster, return as an single item cluster
    const featureInACluster = clusters.map(cluster => cluster.has(index)).reduce((acc, cur) => acc || !!cur, false)
    if (!featureInACluster) {
      result.push([feature])
    }
  })

  return result

}
