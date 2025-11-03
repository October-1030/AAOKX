/**
 * SWR 数据获取器
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    throw error;
  }

  return res.json();
};

/**
 * 带错误处理的 fetcher
 */
export const fetcherWithError = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error: any = new Error(
      errorData.message || "An error occurred while fetching the data."
    );
    error.status = res.status;
    error.info = errorData;
    throw error;
  }

  return res.json();
};
