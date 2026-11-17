import { inviteMessage, inviteUrl, mailtoUrl, whatsappUrl } from './invite-link';

describe('invite-link', () => {
  const base = 'https://project-ea0d4de8-cedf-4542-8fa.web.app';

  it('inviteUrl lleva el código a /vet/link y tolera la barra final', () => {
    expect(inviteUrl(base, 'VET-7K2M9QXA')).toBe(`${base}/vet/link?code=VET-7K2M9QXA`);
    expect(inviteUrl(`${base}/`, 'VET-7K2M9QXA')).toBe(`${base}/vet/link?code=VET-7K2M9QXA`);
  });

  it('el mensaje trae clínica, código y enlace', () => {
    const url = inviteUrl(base, 'VET-7K2M9QXA');
    const msg = inviteMessage('Patitas suaves', 'VET-7K2M9QXA', url);
    expect(msg).toContain('Patitas suaves');
    expect(msg).toContain('VET-7K2M9QXA');
    expect(msg).toContain(url);
  });

  it('whatsapp y mailto codifican el texto', () => {
    const msg = 'Hola & adiós\nlínea 2';
    expect(whatsappUrl(msg)).toBe(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    expect(decodeURIComponent(whatsappUrl(msg).split('text=')[1])).toBe(msg);
    const m = mailtoUrl('Asunto ñ', msg, 'ana@correo.com');
    expect(m.startsWith('mailto:ana%40correo.com?subject=')).toBeTrue();
    expect(m).toContain(`&body=${encodeURIComponent(msg)}`);
  });
});
