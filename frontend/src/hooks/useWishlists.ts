import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Wishlist,
  WishlistDetail,
  WishlistItem,
  CreateWishlistInput,
  UpdateWishlistInput,
  CreateWishlistItemInput,
  UpdateWishlistItemInput,
} from "@/types";
import { api } from "@/lib/api";

export const wishlistsKey = () => ["wishlists"] as const;
export const wishlistKey = (id: string) => ["wishlist", id] as const;
export const wishlistItemKey = (id: string) => ["wishlistItem", id] as const;

export function useWishlists() {
  return useQuery({
    queryKey: wishlistsKey(),
    queryFn: () => api.get<Wishlist[]>("/wishlists"),
  });
}

export function useWishlist(id: string) {
  return useQuery({
    queryKey: wishlistKey(id),
    queryFn: () => api.get<WishlistDetail>(`/wishlists/${id}`),
    enabled: !!id,
  });
}

export function useWishlistItem(id: string) {
  return useQuery({
    queryKey: wishlistItemKey(id),
    queryFn: () => api.get<WishlistItem>(`/items/${id}`),
    enabled: !!id,
  });
}

export function useCreateWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWishlistInput) => api.post<WishlistDetail>("/wishlists", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: wishlistsKey() }),
  });
}

export function useUpdateWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateWishlistInput }) =>
      api.patch<WishlistDetail>(`/wishlists/${id}`, patch),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: wishlistsKey() });
      qc.invalidateQueries({ queryKey: wishlistKey(id) });
    },
  });
}

export function useDeleteWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/wishlists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: wishlistsKey() }),
  });
}

export function useCreateWishlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ wishlistId, input }: { wishlistId: string; input: CreateWishlistItemInput }) =>
      api.post<WishlistItem>(`/wishlists/${wishlistId}/items`, input),
    onSuccess: (_data, { wishlistId }) => {
      qc.invalidateQueries({ queryKey: wishlistKey(wishlistId) });
      qc.invalidateQueries({ queryKey: wishlistsKey() });
    },
  });
}

export function useUpdateWishlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateWishlistItemInput }) =>
      api.patch<WishlistItem>(`/items/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: wishlistKey(data.wishlistId) });
      qc.invalidateQueries({ queryKey: wishlistsKey() });
    },
  });
}

export function useDeleteWishlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; wishlistId: string }) =>
      api.del(`/items/${id}`),
    onSuccess: (_data, { wishlistId }) => {
      qc.invalidateQueries({ queryKey: wishlistKey(wishlistId) });
      qc.invalidateQueries({ queryKey: wishlistsKey() });
    },
  });
}
