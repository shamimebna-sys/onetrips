export interface Flight {
  id: string;
  airline: string;
  logoText: string;
  price: string;
  departure: string;
  arrival: string;
  duration: string;
  class: string;
}

export const fetchFlights = async (origin: string, destination: string): Promise<Flight[]> => {
  try {
    // সরাসরি আমাদের তৈরি করা API কল হচ্ছে
    const response = await fetch(`/api/flights?from=${origin}&to=${destination}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error("API Fetch Error:", error);
    return [];
  }
};