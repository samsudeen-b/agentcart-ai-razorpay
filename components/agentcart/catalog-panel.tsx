"use client";

import Image from "next/image";
import { Check, ChevronDown, ChevronUp, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { formatInr, type Product } from "@/lib/catalog";

type CatalogPanelProps = {
  products: readonly Product[];
  selectedProductIds: readonly string[];
  onToggleProduct: (productId: string) => void;
};

export function CatalogPanel({
  products,
  selectedProductIds,
  onToggleProduct,
}: CatalogPanelProps) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [
        product.name,
        product.category,
        product.description,
        ...product.tags,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [products, search]);

  const visibleProducts =
    search.trim() || showAll
      ? filteredProducts
      : filteredProducts.slice(0, 4);

  return (
    <aside className="ac-catalog" aria-label="Product catalog">
      <div className="ac-panel-heading">
        <h2>Catalog</h2>
        <span>{products.length} products</span>
      </div>

      <label className="ac-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
          aria-label="Search products"
        />
      </label>

      <div className="ac-product-list">
        {visibleProducts.map((product) => {
          const selected = selectedProductIds.includes(product.id);
          const available = product.stock > 0;
          const productNumber =
            products.findIndex((item) => item.id === product.id) + 1;

          return (
            <article
              className={`ac-product ${available ? "" : "is-unavailable"}`}
              key={product.id}
            >
              <Image
                className="ac-product-image"
                src={product.image}
                alt={product.name}
                width={108}
                height={108}
              />

              <div className="ac-product-copy">
                <p className="ac-product-category">{product.category}</p>
                <h3>
                  {productNumber}. {product.name}
                </h3>
                <p className="ac-product-description">
                  {product.description}
                </p>
                <strong>{formatInr(product.pricePaise)}</strong>
                <span
                  className={`ac-stock ${
                    available ? "is-available" : "is-unavailable"
                  }`}
                >
                  {available ? `${product.stock} in stock` : "Out of stock"}
                </span>
              </div>

              <button
                type="button"
                className={`ac-product-action ${
                  selected ? "is-selected" : ""
                }`}
                onClick={() => onToggleProduct(product.id)}
                disabled={!available}
                aria-label={
                  selected
                    ? `Remove ${product.name}`
                    : `Add ${product.name}`
                }
              >
                {selected ? (
                  <Check size={18} aria-hidden="true" />
                ) : (
                  <Plus size={18} aria-hidden="true" />
                )}
              </button>
            </article>
          );
        })}

        {visibleProducts.length === 0 && (
          <p className="ac-empty-catalog">No matching products found.</p>
        )}
      </div>

      {!search.trim() && products.length > 4 && (
        <button
          type="button"
          className="ac-view-products"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Show fewer products" : `View all ${products.length} products`}
          {showAll ? (
            <ChevronUp size={16} aria-hidden="true" />
          ) : (
            <ChevronDown size={16} aria-hidden="true" />
          )}
        </button>
      )}

      <p className="ac-catalog-note">Prices include applicable taxes.</p>
    </aside>
  );
}