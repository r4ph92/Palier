// As URL.hostname writes them: an IPv6 address keeps its brackets.
export const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
export const LOCAL_HOST_NAMES = [...LOCAL_HOSTS].join(', ');
