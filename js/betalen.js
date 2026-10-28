/* Colleo — inschrijven, betalen en contact.
 *
 * Formulieren gaan via Web3Forms naar info@colleo.be (geen eigen server nodig).
 * Betalen gebeurt via vaste Mollie-betaallinks: na het formulier sturen we de
 * deelnemer door naar de juiste link, en Mollie stuurt na betaling terug naar
 * bedankt.html?product=<id>.
 *
 * IN TE VULLEN VOOR DE PUBLICATIE:
 *  - WEB3FORMS_KEY: de access key die Web3Forms naar info@colleo.be mailt.
 *  - MOLLIE: de live betaallinks (de huidige jaarprogramma-link is een TESTlink).
 */
(function () {
  var WEB3FORMS_KEY = ''; // TODO: key van web3forms.com (staat in de mail aan info@colleo.be)

  var PRODUCTEN = {
    jaarprogramma: { naam: 'Colleo jaarprogramma', prijs: 810, mollie: 'https://payment-links.mollie.com/payment/9naA6mNuNgmriPsqFijf6' /* TEST */ },
    finance: { naam: 'E-learning Finance for physios', prijs: 150, mollie: '' },
    voeding: { naam: 'E-learning Voeding in sport, revalidatie en herstel', prijs: 150, mollie: '' },
    pijneducatie: { naam: 'E-learning Complexe pijn', prijs: 150, mollie: '' }
  };

  function verstuur(onderwerp, velden) {
    if (!WEB3FORMS_KEY) return Promise.reject(new Error('Formulierdienst nog niet ingesteld'));
    var body = Object.assign({ access_key: WEB3FORMS_KEY, subject: onderwerp, from_name: 'Colleo website' }, velden);
    return fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.success) throw new Error(j.message || 'Versturen mislukt');
      return j;
    });
  }

  /* Inschrijving/aankoop: gegevens doorsturen en daarna naar Mollie.
   * Geeft { betalen: true } terug als er doorgestuurd wordt, anders { betalen: false }
   * (dan toont de pagina een bevestiging en volgen de betaalinstructies per mail). */
  function schrijfIn(productId, gegevens) {
    var p = PRODUCTEN[productId];
    if (!p) return Promise.reject(new Error('Onbekend product'));
    var velden = Object.assign({ product: p.naam, bedrag: '€' + p.prijs, replyto: gegevens.email }, gegevens);
    return verstuur('Nieuwe inschrijving: ' + p.naam + ' — ' + (gegevens.naam || ''), velden).then(function () {
      try { sessionStorage.setItem('colleo_aankoop', JSON.stringify({ product: productId, naam: gegevens.naam })); } catch (e) {}
      if (p.mollie) { location.href = p.mollie; return { betalen: true }; }
      return { betalen: false };
    });
  }

  function contact(gegevens) {
    return verstuur('Contactformulier: ' + (gegevens.naam || ''), Object.assign({ replyto: gegevens.email }, gegevens));
  }

  window.ColleoBetalen = { PRODUCTEN: PRODUCTEN, schrijfIn: schrijfIn, contact: contact };
})();
