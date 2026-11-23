export function staffResponseOk(response: Response): boolean {
  if (response.status === 401) window.location.replace("/staff");
  if (response.status === 403) window.location.replace("/staff/floor");
  return response.ok;
}
