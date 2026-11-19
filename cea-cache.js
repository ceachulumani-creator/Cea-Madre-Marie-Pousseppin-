/* La copia temporal de nominas y notas no debe saturar el almacenamiento local. */
(function () {
  'use strict';
  const almacen = window.localStorage;
  const memoria = new Map();
  const prototipo = Storage.prototype;
  const leer = prototipo.getItem, escribir = prototipo.setItem, quitar = prototipo.removeItem, vaciar = prototipo.clear;
  const temporal = clave => /^cea_(calificaciones_|calif_|afiliacion_)/.test(clave);
  const equivalencias = {
    cea_calif_detalles:'cea_calificaciones_detalles',
    cea_calif_registros:'cea_calificaciones_registros'
  };
  const canonica = clave => equivalencias[clave] || clave;
  function retirarCopias(clave) {
    quitar.call(almacen,clave);
    for(const alias of Object.keys(equivalencias))if(equivalencias[alias]===clave)quitar.call(almacen,alias);
  }
  prototipo.getItem = function(clave) {
    clave=String(clave);
    if(this===almacen && memoria.has(canonica(clave)))return memoria.get(canonica(clave));
    return leer.call(this,clave);
  };
  prototipo.setItem = function(clave,valor) {
    clave=String(clave);valor=String(valor);
    if(this===almacen && temporal(clave) && valor.length>=128000){
      memoria.set(canonica(clave),valor);retirarCopias(canonica(clave));return;
    }
    try {
      escribir.call(this,clave,valor);
      if(this===almacen)memoria.delete(canonica(clave));
    } catch(error) {
      if(this!==almacen || !temporal(clave) || !/quota/i.test(error.name+' '+error.message))throw error;
      memoria.set(canonica(clave),valor);retirarCopias(canonica(clave));
    }
  };
  prototipo.removeItem = function(clave) {
    clave=String(clave);
    if(this===almacen && memoria.has(canonica(clave))){memoria.delete(canonica(clave));retirarCopias(canonica(clave));return;}
    quitar.call(this,clave);
  };
  prototipo.clear = function(){if(this===almacen)memoria.clear();vaciar.call(this);};
  window.ceaCachePrivada = {clear:()=>memoria.clear()};
  window.addEventListener?.('storage',evento=>{
    if(evento.storageArea!==almacen)return;
    if(!evento.key || evento.key==='cea_session')memoria.clear();
    else if(temporal(evento.key))memoria.delete(canonica(evento.key));
  });
})();
