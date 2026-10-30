// leaflet.markercluster expects a global `L`; import this module BEFORE the plugin.
import L from 'leaflet'
if (typeof window !== 'undefined') (window as unknown as { L: typeof L }).L = L
export default L
